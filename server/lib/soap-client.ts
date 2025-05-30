import soap from 'soap';
import fetch from 'node-fetch';

export interface BBECInteractionField {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface BBECInteractionSubmission {
  constituentId: string;
  prospectName: string;
  contactLevel: string;
  method: string;
  summary: string;
  category: string;
  subcategory: string;
  status: string;
  actualDate: string;
  owner: string;
  comments?: string;
  affinityTags?: string[];
}

class BBECSOAPClient {
  private apiUrl: string;
  private authHeader: string;
  private client: any;
  private wsdlUrl: string;
  private username: string;
  private password: string;

  constructor() {
    this.apiUrl = process.env.BLACKBAUD_API_URL || "https://crm30656d.sky.blackbaud.com/30656d/Appfxwebservice.asmx";
    this.wsdlUrl = this.apiUrl + "?WSDL";
    // Use the Authorization header from environment variable
    this.authHeader = process.env.BLACKBAUD_API_AUTHENTICATION || "Basic QkJFQ0FQSTMwNjU2ZDp1c2JRQkQ1S05tYWNSZWdx";
    this.username = process.env.BLACKBAUD_USERNAME || "BBECAPI30656d";
    this.password = process.env.BLACKBAUD_PASSWORD || "usbQBD5KNmacRegq";
  }

  async initialize(): Promise<void> {
    try {
      // Create SOAP client with Authorization header for WSDL access
      const options = {
        wsdl_headers: {
          'Authorization': this.authHeader
        }
      };
      
      this.client = await soap.createClientAsync(this.wsdlUrl, options);
      this.client.addHttpHeader('Authorization', this.authHeader);
      console.log('BBEC SOAP client initialized successfully');
    } catch (error) {
      console.error('BBEC SOAP client initialization error:', error);
      throw new Error('Failed to initialize BBEC connection: ' + (error as Error).message);
    }
  }

  private async authenticate(): Promise<void> {
    // Authentication is handled via Authorization header
    this.client.addHttpHeader('Authorization', this.authHeader);
  }

  async searchConstituent(searchTerm: string): Promise<any[]> {
    try {
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope 
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
        xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
        xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <SearchListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1">
                    <SearchListID>b9f8dbe9-7240-4f23-b6f6-4103c10c8e62</SearchListID>
                    <SearchText>${searchTerm}</SearchText>
                    <ClientAppInfo REDatabaseToUse="30656d"/>
                </SearchListLoadRequest>
            </soap:Body>
        </soap:Envelope>`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/SearchListLoad',
          'Authorization': this.authHeader,
          'User-Agent': 'NodeJS-BBEC-Client/1.0',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: soapBody
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Constituent search response:', responseText);
      
      // Parse the SOAP response to extract constituent data
      const constituents = this.parseConstituentSearchResponse(responseText);
      return constituents;
    } catch (error) {
      console.error('Constituent search error:', error);
      throw new Error('Failed to search constituents in BBEC: ' + (error as Error).message);
    }
  }

  async getInteractionFormMetadata(): Promise<BBECInteractionField[]> {
    try {
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope 
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
        xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
        xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <DataFormInstanceGetMetaDataRequest xmlns="Blackbaud.AppFx.WebService.API.1">
                    <FormID>41953129-062a-45e6-9540-a1153f9250fa</FormID>
                    <ReturnTemplateSpec>false</ReturnTemplateSpec>
                    <SkipLocalization>true</SkipLocalization>
                    <SkipCustomFieldCharacteristics>true</SkipCustomFieldCharacteristics>
                    <SkipSearchListReplacements>true</SkipSearchListReplacements>
                    <ClientAppInfo REDatabaseToUse="30656d"/>
                </DataFormInstanceGetMetaDataRequest>
            </soap:Body>
        </soap:Envelope>`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataFormInstanceGetMetaData',
          'Authorization': this.authHeader,
          'User-Agent': 'NodeJS-BBEC-Client/1.0',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: soapBody
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Form metadata response:', responseText);
      
      // Parse the metadata response to extract field definitions
      const fields = this.parseFormMetadataResponse(responseText);
      return fields;
    } catch (error) {
      console.error('Form metadata error:', error);
      // Return default fields if metadata call fails
      return [
        { name: "contactLevel", type: "select", required: true, options: ["Personal", "Professional", "Phone", "Email"] },
        { name: "method", type: "select", required: true, options: ["In Person", "Phone", "Email", "Letter", "Other"] },
        { name: "category", type: "select", required: true, options: ["Cultivation", "Solicitation", "Stewardship", "Other"] },
        { name: "subcategory", type: "text", required: false },
        { name: "summary", type: "text", required: true },
        { name: "comments", type: "textarea", required: false },
        { name: "actualDate", type: "date", required: true },
        { name: "prospectName", type: "text", required: true }
      ];
    }
  }

  async submitInteraction(interaction: BBECInteractionSubmission): Promise<string> {
    try {
      // First, search for the constituent to get their ID
      const constituents = await this.searchConstituent(interaction.prospectName);
      
      if (constituents.length === 0) {
        throw new Error(`No constituent found with name: ${interaction.prospectName}`);
      }
      
      const constituentId = constituents[0].id;
      
      // Build the DataFormSave request
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope 
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
        xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
        xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <DataFormSaveRequest xmlns="Blackbaud.AppFx.WebService.API.1">
                    <FormID>41953129-062a-45e6-9540-a1153f9250fa</FormID>
                    <DataFormItem>
                        <Values>
                            <SimpleDataListItem Key="CONSTITUENTID" Value="${constituentId}"/>
                            <SimpleDataListItem Key="CONTACTLEVEL" Value="${interaction.contactLevel}"/>
                            <SimpleDataListItem Key="CONTACTMETHOD" Value="${interaction.method}"/>
                            <SimpleDataListItem Key="SUMMARY" Value="${interaction.summary}"/>
                            <SimpleDataListItem Key="CATEGORY" Value="${interaction.category}"/>
                            <SimpleDataListItem Key="SUBCATEGORY" Value="${interaction.subcategory}"/>
                            <SimpleDataListItem Key="ACTUALDATE" Value="${interaction.actualDate}"/>
                            <SimpleDataListItem Key="COMMENTS" Value="${interaction.comments || ''}"/>
                        </Values>
                    </DataFormItem>
                    <ClientAppInfo REDatabaseToUse="30656d"/>
                </DataFormSaveRequest>
            </soap:Body>
        </soap:Envelope>`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataFormSave',
          'Authorization': this.authHeader,
          'User-Agent': 'NodeJS-BBEC-Client/1.0',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: soapBody
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Interaction submission response:', responseText);
      
      // Parse the response to get the interaction ID
      const interactionId = this.parseSubmissionResponse(responseText);
      return interactionId;
    } catch (error) {
      console.error('Interaction submission error:', error);
      throw new Error('Failed to submit interaction to BBEC: ' + (error as Error).message);
    }
  }

  async searchUserByBUID(buid: string): Promise<any> {
    try {
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope 
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
        xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
        xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <AdHocQueryProcessRequest DoReturnData="true" SuppressDuplicateRows="true" BypassRecordCount="true" SuppressPrimaryKeyField="false" QueryViewID="ee8a7483-c483-4214-9646-4bb62ec29ab7" 
      xmlns="Blackbaud.AppFx.WebService.API.1">
      <SelectFields>
        <f ObjectName="V_QUERY_CONSTITUENT" ColumnName="LOOKUPID" ParentPath="V_QUERY_CONSTITUENT" DisplayPath="V_QUERY_CONSTITUENT" AliasName="uid"/>
        <f ObjectName="V_QUERY_CONSTITUENT" ColumnName="NAME" ParentPath="V_QUERY_CONSTITUENT" DisplayPath="V_QUERY_CONSTITUENT" AliasName="name"/>
        <f ObjectName="USR_V_QUERY_EMAILS_NODE" ColumnName="PrimaryEmail" ParentPath="V_QUERY_CONSTITUENT\\ DAR\\Email Addresses" DisplayPath="V_QUERY_CONSTITUENT\\ DAR\\Email Addresses" AliasName="email"/>
        <f ObjectName="V_QUERY_CONSTITUENT" ColumnName="FIRSTNAME" ParentPath="V_QUERY_CONSTITUENT" DisplayPath="V_QUERY_CONSTITUENT" AliasName="first_name"/>
        <f ObjectName="V_QUERY_CONSTITUENT" ColumnName="KEYNAME" ParentPath="V_QUERY_CONSTITUENT" DisplayPath="V_QUERY_CONSTITUENT" AliasName="last_name"/>
      </SelectFields>
      <FilterFields>
        <f ObjectName="V_QUERY_CONSTITUENT" ColumnName="LOOKUPID" ParentPath="V_QUERY_CONSTITUENT" DisplayPath="V_QUERY_CONSTITUENT" IncludeCurrentNode="true" DataMartLastRefresh="0001-01-01T00:00:00">
          <DateFilterTypes/>
          <FuzzyDateFilterTypes/>
          <MonthDayFilterTypes/>
          <Values>
            <v>${buid}</v>
          </Values>
          <DataType>String</DataType>
        </f>
      </FilterFields>
      <SortFields/>
      <GroupFilterFields/>
      <ClientAppInfo REDatabaseToUse="${this.username}"/>
    </AdHocQueryProcessRequest>
            </soap:Body>
        </soap:Envelope>`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/AdHocQueryProcess',
          'Authorization': this.authHeader,
          'User-Agent': 'NodeJS-BBEC-Client/1.0',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: soapBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`BBEC API error response (${response.status}):`, errorText);
        console.error('Request headers:', response.headers);
        console.error('Request body that failed:', soapBody);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('User search response:', responseText);
      
      const users = this.parseUserSearchResponse(responseText);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('User search error:', error);
      throw new Error('Failed to search user by BUID in BBEC: ' + (error as Error).message);
    }
  }

  async getAffinityTags(): Promise<any[]> {
    try {
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope 
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
        xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
        xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
                <DataListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1" >
                    <DataListID>1d1f6c6f-6804-421a-9964-9e3a7fda5727</DataListID>
                    <ClientAppInfo REDatabaseToUse="30656d"/>
                </DataListLoadRequest>
            </soap:Body>
        </soap:Envelope>`;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataListLoad',
          'Authorization': this.authHeader,
          'User-Agent': 'NodeJS-BBEC-Client/1.0',
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        body: soapBody
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Blackbaud API Response:', responseText);
      
      // Parse the SOAP response to extract affinity tags
      const tags = this.parseAffinityTagsResponse(responseText);
      return tags;
    } catch (error) {
      console.error('Affinity tags retrieval error:', error);
      throw new Error('Failed to retrieve affinity tags from BBEC API: ' + (error as Error).message);
    }
  }

  private parseAffinityTagsResponse(soapResponse: string): any[] {
    try {
      const tags: any[] = [];
      
      // Parse the Blackbaud SOAP response structure: <r><Values><v>value1</v><v>value2</v>...</Values></r>
      const rowRegex = /<r><Values>([\s\S]*?)<\/Values><\/r>/gi;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(soapResponse)) !== null) {
        const valuesContent = rowMatch[1];
        
        // Extract all <v> values from the row
        const valueRegex = /<v>([\s\S]*?)<\/v>/gi;
        const values: string[] = [];
        let valueMatch;
        
        while ((valueMatch = valueRegex.exec(valuesContent)) !== null) {
          values.push(valueMatch[1]);
        }
        
        // Based on the structure I can see, the values appear to be:
        // [0] = ID (GUID), [1] = Name, [2] = Active, [3] = Description, [4] = ?, [5] = LastModified
        if (values.length >= 2 && values[1]) {
          tags.push({
            id: tags.length + 1,
            name: values[1].replace(/&amp;/g, '&'), // Decode XML entities
            category: 'General', // Default category since not provided in this data list
            bbecId: values[0] || null
          });
        }
      }
      
      console.log(`Parsed ${tags.length} affinity tags from SOAP response`);
      return tags;
    } catch (error) {
      console.error('Error parsing affinity tags response:', error);
      return [];
    }
  }

  private parseConstituentSearchResponse(soapResponse: string): any[] {
    try {
      const constituents: any[] = [];
      
      // Extract rows from the SOAP response
      const rowRegex = /<r><Values>([\s\S]*?)<\/Values><\/r>/gi;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(soapResponse)) !== null) {
        const valuesContent = rowMatch[1];
        
        // Extract all <v> values from the row
        const valueRegex = /<v>([\s\S]*?)<\/v>/gi;
        const values: string[] = [];
        let valueMatch;
        
        while ((valueMatch = valueRegex.exec(valuesContent)) !== null) {
          values.push(valueMatch[1]);
        }
        
        // Based on typical search results structure: [0] = ID, [1] = Name, [2] = LookupID
        if (values.length >= 2 && values[1]) {
          constituents.push({
            id: values[0] || null,
            name: values[1].replace(/&amp;/g, '&'),
            lookupId: values[2] || null
          });
        }
      }
      
      return constituents;
    } catch (error) {
      console.error('Error parsing constituent search response:', error);
      return [];
    }
  }

  private parseFormMetadataResponse(soapResponse: string): BBECInteractionField[] {
    try {
      const fields: BBECInteractionField[] = [];
      
      // Extract field definitions from the metadata response
      const fieldRegex = /<Field[^>]*>(.*?)<\/Field>/gs;
      let match;
      
      while ((match = fieldRegex.exec(soapResponse)) !== null) {
        const fieldContent = match[1];
        
        const nameMatch = fieldContent.match(/<Name[^>]*>(.*?)<\/Name>/);
        const typeMatch = fieldContent.match(/<Type[^>]*>(.*?)<\/Type>/);
        const requiredMatch = fieldContent.match(/<Required[^>]*>(.*?)<\/Required>/);
        
        if (nameMatch) {
          fields.push({
            name: nameMatch[1].trim(),
            type: typeMatch ? typeMatch[1].trim().toLowerCase() : 'text',
            required: requiredMatch ? requiredMatch[1].trim().toLowerCase() === 'true' : false,
            options: []
          });
        }
      }
      
      // Return default fields if parsing fails or no fields found
      if (fields.length === 0) {
        return [
          { name: "contactLevel", type: "select", required: true, options: ["Personal", "Professional", "Phone", "Email"] },
          { name: "method", type: "select", required: true, options: ["In Person", "Phone", "Email", "Letter", "Other"] },
          { name: "category", type: "select", required: true, options: ["Cultivation", "Solicitation", "Stewardship", "Other"] },
          { name: "subcategory", type: "text", required: false },
          { name: "summary", type: "text", required: true },
          { name: "comments", type: "textarea", required: false },
          { name: "actualDate", type: "date", required: true },
          { name: "prospectName", type: "text", required: true }
        ];
      }
      
      return fields;
    } catch (error) {
      console.error('Error parsing form metadata response:', error);
      return [
        { name: "contactLevel", type: "select", required: true, options: ["Personal", "Professional", "Phone", "Email"] },
        { name: "method", type: "select", required: true, options: ["In Person", "Phone", "Email", "Letter", "Other"] },
        { name: "category", type: "select", required: true, options: ["Cultivation", "Solicitation", "Stewardship", "Other"] },
        { name: "subcategory", type: "text", required: false },
        { name: "summary", type: "text", required: true },
        { name: "comments", type: "textarea", required: false },
        { name: "actualDate", type: "date", required: true },
        { name: "prospectName", type: "text", required: true }
      ];
    }
  }

  private parseSubmissionResponse(soapResponse: string): string {
    try {
      // Extract the interaction ID from the submission response
      const idMatch = soapResponse.match(/<ID[^>]*>(.*?)<\/ID>/);
      const recordIdMatch = soapResponse.match(/<RecordID[^>]*>(.*?)<\/RecordID>/);
      
      if (idMatch) {
        return idMatch[1].trim();
      } else if (recordIdMatch) {
        return recordIdMatch[1].trim();
      }
      
      // If no ID found, generate a temporary one
      return `temp_${Date.now()}`;
    } catch (error) {
      console.error('Error parsing submission response:', error);
      return `temp_${Date.now()}`;
    }
  }

  private parseUserSearchResponse(soapResponse: string): any[] {
    try {
      const users: any[] = [];
      
      // Extract rows from the SOAP response
      const rowRegex = /<r><Values>([\s\S]*?)<\/Values><\/r>/g;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(soapResponse)) !== null) {
        const valuesContent = rowMatch[1];
        
        // Extract all <v> values from the row
        const valueRegex = /<v>([\s\S]*?)<\/v>/g;
        const values: string[] = [];
        let valueMatch;
        
        while ((valueMatch = valueRegex.exec(valuesContent)) !== null) {
          values.push(valueMatch[1]);
        }
        
        // Based on the query structure: [0] = uid, [1] = name, [2] = email, [3] = first_name, [4] = last_name
        if (values.length >= 2 && values[0]) {
          users.push({
            uid: values[0] || '',
            name: values[1] || '',
            email: values[2] || '',
            first_name: values[3] || '',
            last_name: values[4] || ''
          });
        }
      }
      
      return users;
    } catch (error) {
      console.error('Error parsing user search response:', error);
      return [];
    }
  }
}

export const bbecClient = new BBECSOAPClient();
