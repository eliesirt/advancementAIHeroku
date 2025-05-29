import soap from 'soap';

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
  private wsdlUrl: string;
  private username: string;
  private password: string;
  private client: any;

  constructor() {
    this.wsdlUrl = process.env.BBEC_SOAP_WSDL_URL || process.env.BBEC_WSDL || "http://default-bbec-url/soap?wsdl";
    this.username = process.env.BBEC_USERNAME || process.env.BBEC_USER || "default_user";
    this.password = process.env.BBEC_PASSWORD || process.env.BBEC_PASS || "default_pass";
  }

  async initialize(): Promise<void> {
    try {
      this.client = await soap.createClientAsync(this.wsdlUrl);
      await this.authenticate();
    } catch (error) {
      console.error('BBEC SOAP client initialization error:', error);
      throw new Error('Failed to initialize BBEC connection: ' + (error as Error).message);
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const authResult = await this.client.AuthenticateAsync({
        Username: this.username,
        Password: this.password
      });
      
      if (!authResult.success) {
        throw new Error('BBEC authentication failed');
      }
    } catch (error) {
      console.error('BBEC authentication error:', error);
      throw new Error('Failed to authenticate with BBEC: ' + (error as Error).message);
    }
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
      if (!this.client) await this.initialize();
      
      const tagsResult = await this.client.GetAffinityTagsAsync();
      return tagsResult.tags || [];
    } catch (error) {
      console.error('Affinity tags retrieval error:', error);
      // Return default tags if API fails
      return [
        { id: '1', name: 'Medical Research', category: 'Professional' },
        { id: '2', name: 'Healthcare Technology', category: 'Professional' },
        { id: '3', name: 'Education Support', category: 'Philanthropic' },
        { id: '4', name: 'Arts & Culture', category: 'Personal' },
        { id: '5', name: 'Technology Innovation', category: 'Professional' }
      ];
    }
  }
}

export const bbecClient = new BBECSOAPClient();
