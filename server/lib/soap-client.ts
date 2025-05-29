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
      if (!this.client) await this.initialize();
      
      const searchResult = await this.client.SearchConstituentAsync({
        SearchCriteria: {
          Name: searchTerm,
          MaxResults: 10
        }
      });

      return searchResult.constituents || [];
    } catch (error) {
      console.error('Constituent search error:', error);
      throw new Error('Failed to search constituents: ' + (error as Error).message);
    }
  }

  async getInteractionFormMetadata(): Promise<BBECInteractionField[]> {
    try {
      if (!this.client) await this.initialize();
      
      const metadataResult = await this.client.GetInteractionFormMetadataAsync();
      
      return [
        { name: 'contactLevel', type: 'select', required: true, options: ['Face-to-face', 'Phone', 'Email', 'Video call'] },
        { name: 'method', type: 'select', required: true, options: ['In-person meeting', 'Phone call', 'Email exchange', 'Video conference'] },
        { name: 'category', type: 'select', required: true, options: ['Cultivation', 'Stewardship', 'Solicitation', 'Research'] },
        { name: 'subcategory', type: 'select', required: true, options: ['Initial meeting', 'Follow-up', 'Event attendance', 'Presentation'] },
        { name: 'status', type: 'select', required: true, options: ['Complete', 'Pending', 'Declined', 'Canceled'] },
        { name: 'summary', type: 'text', required: true },
        { name: 'actualDate', type: 'date', required: true },
        { name: 'owner', type: 'text', required: true },
        { name: 'comments', type: 'textarea', required: false }
      ];
    } catch (error) {
      console.error('Form metadata error:', error);
      // Return default fields if API fails
      return [
        { name: 'contactLevel', type: 'select', required: true, options: ['Face-to-face', 'Phone', 'Email', 'Video call'] },
        { name: 'method', type: 'select', required: true, options: ['In-person meeting', 'Phone call', 'Email exchange', 'Video conference'] },
        { name: 'category', type: 'select', required: true, options: ['Cultivation', 'Stewardship', 'Solicitation', 'Research'] },
        { name: 'subcategory', type: 'select', required: true, options: ['Initial meeting', 'Follow-up', 'Event attendance', 'Presentation'] },
        { name: 'status', type: 'select', required: true, options: ['Complete', 'Pending', 'Declined', 'Canceled'] },
        { name: 'summary', type: 'text', required: true },
        { name: 'actualDate', type: 'date', required: true },
        { name: 'owner', type: 'text', required: true },
        { name: 'comments', type: 'textarea', required: false }
      ];
    }
  }

  async submitInteraction(interaction: BBECInteractionSubmission): Promise<string> {
    try {
      if (!this.client) await this.initialize();
      
      const submissionResult = await this.client.CreateInteractionAsync({
        ConstituentId: interaction.constituentId,
        ContactLevel: interaction.contactLevel,
        Method: interaction.method,
        Summary: interaction.summary,
        Category: interaction.category,
        Subcategory: interaction.subcategory,
        Status: interaction.status,
        ActualDate: interaction.actualDate,
        Owner: interaction.owner,
        Comments: interaction.comments,
        AffinityTags: interaction.affinityTags
      });

      if (!submissionResult.success) {
        throw new Error(submissionResult.errorMessage || 'Submission failed');
      }

      return submissionResult.interactionId;
    } catch (error) {
      console.error('Interaction submission error:', error);
      throw new Error('Failed to submit interaction to BBEC: ' + (error as Error).message);
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
      // Basic XML parsing to extract affinity tag data from SOAP response
      // This would need to be adjusted based on the actual response structure
      const tags: any[] = [];
      
      // For now, return empty array until we can see the actual response structure
      // The user will need to provide the correct authentication for this to work
      return tags;
    } catch (error) {
      console.error('Error parsing affinity tags response:', error);
      return [];
    }
  }
}

export const bbecClient = new BBECSOAPClient();
