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
    const response = body.DataListLoadResponse;
    const result = response.DataListLoadResult;
    
    // Normalize rows to always be an array (explicitArray: false may return single object)
    let rawRows = result?.Rows?.Row || [];
    const rows = Array.isArray(rawRows) ? rawRows : [rawRows];
    
    console.log(`🔍 [BBEC Service] Parsing ${rows.length} interaction rows from SOAP response`);
    
    // Transform rows into our interaction format
    const interactions = rows.map((row: any, index: number) => {
      try {
        // Normalize values to array (explicitArray: false may return single object)
        let rawValues = row.Values?.Value || [];
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        
        // Map BBEC response values to our schema with safer field extraction
        const fieldMap = buildFieldMap(values);
        
        return {
          constituentId: getFieldValue(fieldMap, 'CONSTITUENTID') || '',
          name: getFieldValue(fieldMap, 'Name') || '',
          lastName: getFieldValue(fieldMap, 'Last Name') || '',
          lookupId: getFieldValue(fieldMap, 'LookupID') || '',
          interactionLookupId: getFieldValue(fieldMap, 'Interaction Lookup ID') || '',
          interactionId: getFieldValue(fieldMap, 'INTERACTIONID') || '',
          summary: getFieldValue(fieldMap, 'Summary') || '',
          comment: getFieldValue(fieldMap, 'Comment') || '',
          date: parseDate(getFieldValue(fieldMap, 'Date')),
          contactMethod: getFieldValue(fieldMap, 'Contact Method') || '',
          prospectManagerId: getFieldValue(fieldMap, 'ProspectManagerID') || ''
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
    const response = body.DataListLoadResponse;
    const result = response.DataListLoadResult;
    
    // Normalize rows to always be an array (explicitArray: false may return single object)
    let rawRows = result?.Rows?.Row || [];
    const rows = Array.isArray(rawRows) ? rawRows : [rawRows];
    
    console.log(`🔍 [BBEC Service] Parsing ${rows.length} prospect rows from SOAP response`);
    
    // Transform rows into our prospect format
    const prospects = rows.map((row: any, index: number) => {
      try {
        // Normalize values to array (explicitArray: false may return single object)
        let rawValues = row.Values?.Value || [];
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        
        // Map BBEC response values to our schema with safer field extraction
        const fieldMap = buildFieldMap(values);
        
        // Extract prospect data from BBEC fields
        const prospect = {
          buid: getFieldValue(fieldMap, 'LOOKUPID') || getFieldValue(fieldMap, 'lookup_id'),
          bbecGuid: getFieldValue(fieldMap, 'ID') || getFieldValue(fieldMap, 'constituent_id'),
          constituentGuid: getFieldValue(fieldMap, 'ID') || getFieldValue(fieldMap, 'constituent_id'),
          firstName: getFieldValue(fieldMap, 'FIRSTNAME') || getFieldValue(fieldMap, 'first_name'),
          lastName: getFieldValue(fieldMap, 'LASTNAME') || getFieldValue(fieldMap, 'last_name'),
          fullName: getFieldValue(fieldMap, 'NAME') || getFieldValue(fieldMap, 'full_name'),
          email: getFieldValue(fieldMap, 'EMAIL') || getFieldValue(fieldMap, 'email'),
          phone: getFieldValue(fieldMap, 'PHONE') || getFieldValue(fieldMap, 'phone'),
          prospectRating: getFieldValue(fieldMap, 'PROSPECTSTATUS') || getFieldValue(fieldMap, 'prospect_rating'),
          stage: getFieldValue(fieldMap, 'STAGE') || 'Identification',
          lastContactDate: getFieldValue(fieldMap, 'LASTCONTACTDATE') ? parseDate(getFieldValue(fieldMap, 'LASTCONTACTDATE')) : null,
          nextContactDate: getFieldValue(fieldMap, 'NEXTCONTACTDATE') ? parseDate(getFieldValue(fieldMap, 'NEXTCONTACTDATE')) : null,
          lifetimeGiving: getFieldValue(fieldMap, 'LIFETIMEGIVING') ? parseInt(getFieldValue(fieldMap, 'LIFETIMEGIVING') || '0') : 0,
          lastGiftDate: getFieldValue(fieldMap, 'LASTGIFTDATE') ? parseDate(getFieldValue(fieldMap, 'LASTGIFTDATE')) : null,
          lastSyncedAt: new Date(),
          prospectManagerId: getFieldValue(fieldMap, 'PROSPECTMANAGERID') || getFieldValue(fieldMap, 'prospect_manager_id')
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