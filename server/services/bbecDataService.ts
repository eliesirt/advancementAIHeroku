/**
 * BBEC Data Service - Placeholder functions for future BBEC API integration
 * These functions will be enhanced to make actual BBEC API calls in the future
 */

export const fetchInteractions = async ({ 
  authUserId, 
  contextRecordId 
}: { 
  authUserId: string; 
  contextRecordId?: string; 
}): Promise<any> => {
  console.log(`🔄 [BBEC Service] Fetching interactions for user ID: ${authUserId}, context: ${contextRecordId || 'default'}`);
  
  try {
    // Get authenticated user's BBEC credentials from storage
    const { storage } = await import('../storage');
    const user = await storage.getUser(authUserId);
    
    if (!user || !user.bbecUsername || !user.bbecPassword) {
      throw new Error(`User ${authUserId} missing BBEC credentials`);
    }
    
    // Create authorization header
    const credentials = Buffer.from(`${user.bbecUsername}:${user.bbecPassword}`).toString('base64');
    const authHeader = `Basic ${credentials}`;
    
    // Get configurable endpoint and database settings
    const endpoint = process.env.BBEC_ENDPOINT || 'https://crm30656d.sky.blackbaud.com/30656d/Appfxwebservice.asmx';
    const databaseToUse = process.env.BBEC_DATABASE || '30656d';
    const actualContextRecordId = contextRecordId || user.bbecGuid || user.id;
    
    // SOAP request XML for DataListLoad
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Body>
<DataListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1">
<DataListID>79a88742-527e-4aeb-8048-ccd086dd416d</DataListID>
<ContextRecordID>${actualContextRecordId}</ContextRecordID>
<ClientAppInfo REDatabaseToUse="${databaseToUse}"/>
</DataListLoadRequest>
</soap:Body>
</soap:Envelope>`;

    console.log(`🔥 [BBEC Service] Making SOAP call for interactions data...`);
    
    // Make SOAP request to BBEC using fetch (following existing pattern)
    const endpointUrl = new URL(endpoint);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Host': endpointUrl.hostname,
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataListLoad',
        'Authorization': authHeader,
        'User-Agent': 'NodeJS-BBEC-Client/1.0',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      body: soapRequest
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    
    console.log(`✅ [BBEC Service] Raw SOAP response received, processing data...`);
    
    // Parse SOAP response and extract interaction data
    const interactions = await parseInteractionsResponse(responseText);
    
    console.log(`✅ [BBEC Service] Interactions fetch completed for user: ${authUserId}, found ${interactions.length} interactions`);
    
    return {
      authUserId,
      contextRecordId: actualContextRecordId,
      interactions,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    
  } catch (error) {
    console.error(`❌ [BBEC Service] Interactions fetch failed for user ${authUserId}:`, error);
    throw error;
  }
};

// Helper function to parse SOAP response and extract interaction data
const parseInteractionsResponse = async (soapResponse: string): Promise<any[]> => {
  try {
    // Import XML parser with namespace stripping
    const { parseStringPromise, processors } = await import('xml2js');
    
    // Parse the XML response with robust options
    const parsed = await parseStringPromise(soapResponse, {
      explicitArray: false,
      tagNameProcessors: [processors.stripPrefix]
    });
    
    // Navigate through SOAP envelope to get data list rows
    const envelope = parsed.Envelope;
    const body = envelope.Body;
    const response = body.DataListLoadReply;  // Fixed: API returns Reply not Response
    
    // Normalize rows to always be an array (explicitArray: false may return single object)
    let rawRows = response?.Rows?.r || [];  // Fixed: API uses 'r' not 'Row'
    const rows = Array.isArray(rawRows) ? rawRows : [rawRows];
    
    console.log(`🔍 [BBEC Service] Parsing ${rows.length} interaction rows from SOAP response`);
    
    // Transform rows into our interaction format
    const interactions = rows.map((row: any, index: number) => {
      try {
        // Normalize values to array (explicitArray: false may return single object)
        let rawValues = row.Values?.v || [];  // Fixed: API uses 'v' not 'Value'
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        
        // TODO: Fix interactions field mapping - BBEC uses array indexing, not named fields
        // For now, return empty data to prevent parsing errors while preserving system functionality
        // The exact array indices for interactions need to be determined through API analysis
        console.warn(`⚠️ [BBEC Service] Interactions parsing temporarily disabled - field mapping needs array index analysis`);
        
        return {
          constituentId: values[0] || '',     // Placeholder - exact index TBD 
          name: values[1] || '',              // Placeholder - exact index TBD
          lastName: values[2] || '',          // Placeholder - exact index TBD  
          lookupId: values[3] || '',          // Placeholder - exact index TBD
          interactionLookupId: values[4] || '', // Placeholder - exact index TBD
          interactionId: values[5] || '',     // Placeholder - exact index TBD
          summary: values[6] || '',           // Placeholder - exact index TBD
          comment: values[7] || '',           // Placeholder - exact index TBD
          date: values[8] ? parseDate(values[8]) : null, // Placeholder - exact index TBD
          contactMethod: values[9] || '',     // Placeholder - exact index TBD
          prospectManagerId: values[10] || '' // Placeholder - exact index TBD
        };
      } catch (rowError) {
        console.error(`❌ [BBEC Service] Error parsing row ${index}:`, rowError);
        return null;
      }
    }).filter((interaction: any) => interaction !== null);
    
    console.log(`✅ [BBEC Service] Successfully parsed ${interactions.length} interactions`);
    return interactions;
    
  } catch (parseError) {
    console.error(`❌ [BBEC Service] Error parsing SOAP response:`, parseError);
    throw new Error(`Failed to parse interactions response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
};

// Helper function to build field map from BBEC response values
const buildFieldMap = (values: any[]): Record<string, string> => {
  const fieldMap: Record<string, string> = {};
  
  if (Array.isArray(values)) {
    values.forEach((value: any) => {
      // Handle different value structures from BBEC
      if (value && typeof value === 'object') {
        const fieldName = value.$.Name || value.name;
        const fieldValue = value._ || value.value || value;
        if (fieldName && fieldValue !== undefined) {
          fieldMap[fieldName] = String(fieldValue);
        }
      }
    });
  }
  
  return fieldMap;
};

// Helper function to safely extract field value from map
const getFieldValue = (fieldMap: Record<string, string>, fieldName: string): string | null => {
  return fieldMap[fieldName] || null;
};

// Helper function to parse date from BBEC format
const parseDate = (dateString: string | null): Date => {
  if (!dateString) return new Date();
  
  try {
    // Handle various BBEC date formats
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  } catch (error) {
    console.warn(`⚠️ [BBEC Service] Could not parse date: ${dateString}`);
    return new Date();
  }
};

export const fetchDonationSummary = async (prospectId: string): Promise<any> => {
  console.log(`🔄 [BBEC Service] Fetching donation summary for prospect ID: ${prospectId}`);
  
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 800));
  
  console.log(`✅ [BBEC Service] Donation summary fetch completed for prospect ID: ${prospectId}`);
  
  // TODO: Replace with actual BBEC API call
  return {
    prospectId,
    totalDonations: 0,
    lastDonationDate: null,
    timestamp: new Date().toISOString(),
    status: 'placeholder'
  };
};

export const fetchResearchNotes = async (prospectId: string): Promise<any> => {
  console.log(`🔄 [BBEC Service] Fetching research notes for prospect ID: ${prospectId}`);
  
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  console.log(`✅ [BBEC Service] Research notes fetch completed for prospect ID: ${prospectId}`);
  
  // TODO: Replace with actual BBEC API call
  return {
    prospectId,
    researchNotes: [],
    timestamp: new Date().toISOString(),
    status: 'placeholder'
  };
};

export const fetchSolicitationPlans = async (prospectId: string): Promise<any> => {
  console.log(`🔄 [BBEC Service] Fetching solicitation plans for prospect ID: ${prospectId}`);
  
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 900));
  
  console.log(`✅ [BBEC Service] Solicitation plans fetch completed for prospect ID: ${prospectId}`);
  
  // TODO: Replace with actual BBEC API call
  return {
    prospectId,
    solicitationPlans: [],
    timestamp: new Date().toISOString(),
    status: 'placeholder'
  };
};

export const fetchProspects = async ({ 
  authUserId, 
  contextRecordId 
}: { 
  authUserId: string; 
  contextRecordId?: string; 
}): Promise<any> => {
  console.log(`🔄 [BBEC Service] Fetching prospects for user ID: ${authUserId}, context: ${contextRecordId || 'default'}`);
  
  try {
    // Get authenticated user's BBEC credentials from storage
    const { storage } = await import('../storage');
    const user = await storage.getUser(authUserId);
    
    if (!user || !user.bbecUsername || !user.bbecPassword) {
      throw new Error(`User ${authUserId} missing BBEC credentials`);
    }
    
    // Create authorization header
    const credentials = Buffer.from(`${user.bbecUsername}:${user.bbecPassword}`).toString('base64');
    const authHeader = `Basic ${credentials}`;
    
    // Get configurable endpoint and database settings
    const endpoint = process.env.BBEC_ENDPOINT || 'https://crm30656d.sky.blackbaud.com/30656d/Appfxwebservice.asmx';
    const databaseToUse = process.env.BBEC_DATABASE || '30656d';
    const actualContextRecordId = contextRecordId || user.bbecGuid || user.id;
    
    // SOAP request XML for DataListLoad - Prospects Portfolio
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Body>
<DataListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1">
<DataListID>b38fb74f-3549-46e2-b089-fc1351dfb959</DataListID>
<ContextRecordID>${actualContextRecordId}</ContextRecordID>
<ClientAppInfo REDatabaseToUse="${databaseToUse}"/>
</DataListLoadRequest>
</soap:Body>
</soap:Envelope>`;

    console.log(`🔥 [BBEC Service] Making SOAP call for prospects data...`);
    
    // Make SOAP request to BBEC using fetch (following existing pattern)
    const endpointUrl = new URL(endpoint);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Host': endpointUrl.hostname,
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataListLoad',
        'Authorization': authHeader,
        'User-Agent': 'NodeJS-BBEC-Client/1.0',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      body: soapRequest
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    
    console.log(`✅ [BBEC Service] Raw SOAP response received, processing prospects data...`);
    
    // Parse SOAP response and extract prospects data
    const prospects = await parseProspectsResponse(responseText);
    
    console.log(`✅ [BBEC Service] Prospects fetch completed for user: ${authUserId}, found ${prospects.length} prospects`);
    
    return {
      authUserId,
      contextRecordId: actualContextRecordId,
      prospects,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
    
  } catch (error) {
    console.error(`❌ [BBEC Service] Prospects fetch failed for user ${authUserId}:`, error);
    throw error;
  }
};

// Helper function to parse SOAP response and extract prospects data
const parseProspectsResponse = async (soapResponse: string): Promise<any[]> => {
  try {
    // Import XML parser with namespace stripping
    const { parseStringPromise, processors } = await import('xml2js');
    
    // Parse the XML response with robust options
    const parsed = await parseStringPromise(soapResponse, {
      explicitArray: false,
      tagNameProcessors: [processors.stripPrefix]
    });
    
    // Navigate through SOAP envelope to get data list rows
    const envelope = parsed.Envelope;
    const body = envelope.Body;
    const response = body.DataListLoadReply;  // Fixed: API returns Reply not Response
    
    // Normalize rows to always be an array (explicitArray: false may return single object)
    let rawRows = response?.Rows?.r || [];  // Fixed: API uses 'r' not 'Row'
    const rows = Array.isArray(rawRows) ? rawRows : [rawRows];
    
    console.log(`🔍 [BBEC Service] Parsing ${rows.length} prospect rows from SOAP response`);
    
    // Transform rows into our prospect format
    const prospects = rows.map((row: any, index: number) => {
      try {
        // Normalize values to array (explicitArray: false may return single object) 
        let rawValues = row.Values?.v || [];  // Fixed: API uses 'v' not 'Value'
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        
        // Extract prospect data using direct array indexing (based on BBEC API structure)
        // Array indices determined from API analysis: 
        // [0]=ID/BBEC_GUID, [1]=Full_Name, [2]=First_Name, [3]=Last_Name, [4]=BUID, 
        // [5]=Prospect_Manager_ID, [6]=Full_Name_With_Title, [7]=Lifetime_Giving, [12]=Affinity_Tags, [13]=Capacity_Rating
        // [14]=City, [15]=State, [16]=Country (newly added location fields)
        
        
        // Debug: Log the entire values array to find location data
        if (index === 0) {
          console.log('🔍 [BBEC DEBUG] Full values array analysis:', {
            totalLength: values.length,
            indices_0_to_9: values.slice(0, 10),
            indices_10_to_19: values.slice(10, 20),
            indices_20_to_29: values.slice(20, 30),
            indices_30_to_39: values.slice(30, 40),
            searchingForLocationData: 'Address fields should contain city/state/country strings'
          });
        }
        
        const prospect = {
          buid: values[4] || '',                               // Array index 4: BUID
          bbecGuid: values[0] || '',                           // Array index 0: ID/BBEC GUID
          constituentGuid: values[0] || '',                    // Array index 0: ID/BBEC GUID (same as bbecGuid)
          firstName: values[2] || '',                          // Array index 2: First Name
          lastName: values[3] || '',                           // Array index 3: Last Name  
          fullName: values[6] || values[1] || `${values[2] || ''} ${values[3] || ''}`.trim(), // Array index 6 (with title), fallback to index 1, or construct from first/last
          email: null,                                         // Not available in BBEC prospects API
          phone: null,                                         // Not available in BBEC prospects API
          // Location fields - searching through higher indices since not in documented 0-13 range
          city: values[17] || values[18] || values[19] || null,     // Trying indices 17-19 for City
          state: values[20] || values[21] || values[22] || null,    // Trying indices 20-22 for State  
          country: values[23] || values[24] || values[25] || null,  // Trying indices 23-25 for Country
          prospectRating: values[13] || null,                  // Array index 13: Capacity Rating (e.g., "E-$100K - $249k")
          stage: 'Identification',                             // Default stage (not in BBEC API)
          lastContactDate: null,                               // Not available in BBEC prospects API
          nextContactDate: null,                               // Not available in BBEC prospects API
          lifetimeGiving: values[7] ? Math.round(parseFloat(values[7]) || 0) : 0, // Array index 7: Lifetime Giving (convert to integer)
          lastGiftDate: null,                                  // Not available in BBEC prospects API
          lastSyncedAt: new Date(),                            // Set current timestamp
          prospectManagerId: values[5] || null,                // Array index 5: Prospect Manager ID  
          affinityTags: values[12] ? values[12].toString().split(';').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0) : [] // Array index 12: Affinity tags (split by semicolon)
        };
        
        // Filter out invalid prospects (missing required fields)
        if (!prospect.buid || (!prospect.firstName && !prospect.fullName)) {
          console.warn(`⚠️ [BBEC Service] Skipping invalid prospect at index ${index}: missing required fields`);
          return null;
        }
        
        console.log(`✅ [BBEC Service] Processed prospect ${index + 1}: ${prospect.fullName || `${prospect.firstName} ${prospect.lastName}`} (${prospect.buid})`);
        return prospect;
        
      } catch (error) {
        console.error(`❌ [BBEC Service] Error processing prospect at index ${index}:`, error);
        return null;
      }
    }).filter(prospect => prospect !== null);
    
    console.log(`✅ [BBEC Service] Successfully processed ${prospects.length} valid prospects`);
    return prospects;
    
  } catch (error) {
    console.error('❌ [BBEC Service] Error parsing prospects SOAP response:', error);
    throw new Error(`Failed to parse prospects response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};