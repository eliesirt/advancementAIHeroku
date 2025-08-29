#!/usr/bin/env node

// Script to get Heroku logs for debugging affinity matching
import https from 'https';

async function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'advancement-ai-b8abf01faf28.herokuapp.com',
      port: 443,
      path: '/api/voice-recordings/process-direct',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': 'connect.sid=s%3AsampleCookie'
      }
    };

    console.log('🧪 Sending test request to Heroku...');
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('\n✅ Response received from Heroku');
          console.log('🎯 Affinity Tags Found:', parsed.extractedInfo?.suggestedAffinityTags?.length || 0);
          console.log('📋 Tags:', JSON.stringify(parsed.extractedInfo?.suggestedAffinityTags || []));
          console.log('🔍 Interests:', {
            personal: parsed.extractedInfo?.personalInterests || [],
            philanthropic: parsed.extractedInfo?.philanthropicPriorities || []
          });
          
          resolve(parsed);
        } catch (e) {
          console.error('❌ Failed to parse response:', e.message);
          console.log('Raw response:', data.substring(0, 500));
          resolve({ error: 'Invalid JSON', raw: data });
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Request failed:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function checkLogs() {
  console.log('🔍 Testing Heroku voice processing with explicit debugging...\n');
  
  try {
    const testData = {
      transcript: "Ice Hockey scholarship donation debug test",
      audioData: "test",
      duration: 2
    };
    
    console.log('📝 Test transcript:', testData.transcript);
    
    const response = await makeRequest(testData);
    
    if (response.error) {
      console.error('\n❌ Error in response:', response.error);
    } else {
      console.log('\n📊 Summary:');
      console.log('- Transcript processed successfully');
      console.log('- Interests extracted:', (response.extractedInfo?.personalInterests?.length || 0) + (response.extractedInfo?.philanthropicPriorities?.length || 0));
      console.log('- Affinity tags found:', response.extractedInfo?.suggestedAffinityTags?.length || 0);
      
      if ((response.extractedInfo?.suggestedAffinityTags?.length || 0) === 0) {
        console.log('\n⚠️  ISSUE CONFIRMED: No affinity tags found despite interests being extracted');
        console.log('This confirms the voice processing route affinity matching is failing in Heroku');
      } else {
        console.log('\n✅ SUCCESS: Affinity tags found!');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

checkLogs();