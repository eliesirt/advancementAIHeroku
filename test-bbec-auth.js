// Test BBEC authentication with different formats
import fetch from 'node-fetch';

async function testBBECAuth() {
  const authHeader = process.env.BLACKBAUD_API_AUTHENTICATION || "";
  const apiUrl = 'https://crm30656d.sky.blackbaud.com/7d6e1ca0-9d84-4282-a36c-7f5b5b3b90b5/webapi/AppFx.asmx';
  
  console.log('Testing BBEC authentication...');
  console.log('Auth header format:', authHeader ? `${authHeader.substring(0, 20)}...` : 'EMPTY');
  console.log('Auth header length:', authHeader.length);
  console.log('Starts with "Basic":', authHeader.startsWith('Basic '));
  
  // Test with current auth header
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Host': 'crm30656d.sky.blackbaud.com',
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataListLoad',
        'Authorization': authHeader,
        'User-Agent': 'NodeJS-BBEC-Client/1.0'
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <DataListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1">
              <DataListID>1d1f6c6f-6804-421a-9964-9e3a7fda5727</DataListID>
              <ClientAppInfo REDatabaseToUse="30656d"/>
            </DataListLoadRequest>
          </soap:Body>
        </soap:Envelope>`
    });
    
    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text.substring(0, 200));
    } else {
      console.log('SUCCESS: Authentication working!');
    }
    
  } catch (error) {
    console.error('Request error:', error.message);
  }
  
  // Test if it needs "Basic " prefix
  if (!authHeader.startsWith('Basic ')) {
    console.log('\nTesting with "Basic " prefix...');
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'Blackbaud.AppFx.WebService.API.1/DataListLoad',
          'Authorization': `Basic ${authHeader}`,
          'User-Agent': 'NodeJS-BBEC-Client/1.0'
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <DataListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1">
                <DataListID>1d1f6c6f-6804-421a-9964-9e3a7fda5727</DataListID>
                <ClientAppInfo REDatabaseToUse="30656d"/>
              </DataListLoadRequest>
            </soap:Body>
          </soap:Envelope>`
      });
      
      console.log('With Basic prefix - Response status:', response.status);
      console.log('With Basic prefix - Response statusText:', response.statusText);
      
      if (response.ok) {
        console.log('SUCCESS: Authentication working with Basic prefix!');
      }
      
    } catch (error) {
      console.error('Basic prefix test error:', error.message);
    }
  }
}

testBBECAuth().catch(console.error);