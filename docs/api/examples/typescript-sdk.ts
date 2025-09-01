/**
 * TypeScript SDK Usage Example
 * 
 * This example demonstrates how to use the generated TypeScript SDK
 * for type-safe API interactions with the Bulgarian Voice Coach.
 */

import { 
  ContentService, 
  TtsService, 
  ConfigService,
  type AnalyzeTextRequest,
  type UpdateL1Request 
} from '../../client/src/sdk';

// Configure the SDK base URL
import { OpenAPI } from '../../client/src/sdk/core/OpenAPI';
OpenAPI.BASE = 'http://localhost:8000';

async function main() {
  console.log('🚀 Bulgarian Voice Coach API SDK Example');
  
  try {
    // 1. Get application configuration
    console.log('\n📋 Getting app configuration...');
    const config = await ConfigService.getAppConfigApiConfigGet();
    console.log('Supported languages:', config.supported_languages);
    console.log('Current L1 language:', config.l1_language);
    
    // 2. Update L1 language preference
    console.log('\n🌍 Updating L1 language to Russian...');
    const updateRequest: UpdateL1Request = {
      l1_language: 'RU'
    };
    const updateResponse = await ConfigService.updateL1LanguageApiConfigL1Post(updateRequest);
    console.log('Updated L1 language:', updateResponse.l1_language);
    
    // 3. Analyze Bulgarian text for grammar errors
    console.log('\n📝 Analyzing Bulgarian text...');
    const analysisRequest: AnalyzeTextRequest = {
      text: "Искам поръчвам кафе и хляб.",  // Intentional grammar error
      l1: 'RU'  // Russian contrast notes
    };
    
    const analysis = await ContentService.analyzeTextContentAnalyzePost(analysisRequest);
    
    console.log('Original text:', analysis.text);
    console.log('Corrections found:', analysis.corrections.length);
    
    // Display each correction
    analysis.corrections.forEach((correction, index) => {
      console.log(`\nCorrection ${index + 1}:`);
      console.log(`  Type: ${correction.type}`);
      console.log(`  Error: "${correction.before}" → "${correction.after}"`);
      console.log(`  Note: ${correction.note}`);
    });
    
    // Display drill suggestions
    if (analysis.drill_suggestions.length > 0) {
      console.log('\n🎯 Practice drills suggested:');
      analysis.drill_suggestions.forEach((suggestion, index) => {
        console.log(`\nDrill ${index + 1} (${suggestion.grammar_id}):`);
        console.log(`  Explanation: ${suggestion.explanation}`);
        if (suggestion.contrast_note) {
          console.log(`  L1 Contrast: ${suggestion.contrast_note}`);
        }
        
        // Show first drill
        if (suggestion.drills.length > 0) {
          const drill = suggestion.drills[0];
          console.log(`  Practice: ${drill.prompt_bg}`);
          console.log(`  Answer: ${drill.answer_bg}`);
        }
      });
    }
    
    // 4. Get grammar item details
    if (analysis.corrections.length > 0) {
      const grammarId = analysis.corrections[0].error_tag;
      console.log(`\n📚 Getting details for grammar rule: ${grammarId}`);
      
      const grammarDetails = await ContentService.getGrammarContentGrammarGrammarIdGet(
        grammarId, 
        'RU'  // Russian contrast notes
      );
      
      console.log('Grammar rule title:', grammarDetails.title_bg);
      console.log('Explanation:', grammarDetails.micro_explanation_bg);
      
      if (grammarDetails.contrast_notes?.RU) {
        console.log('Russian contrast:', grammarDetails.contrast_notes.RU);
      }
    }
    
    // 5. Get available TTS profiles
    console.log('\n🔊 Getting available TTS profiles...');
    const profiles = await TtsService.getTtsProfilesTtsProfilesGet();
    console.log('Available profiles:', Object.keys(profiles.profiles.available_profiles));
    console.log('Current profile:', profiles.profiles.current_profile);
    
    // 6. Get conversation scenarios
    console.log('\n💬 Getting conversation scenarios...');
    const scenarios = await ContentService.getScenariosContentScenariosGet();
    console.log(`Found ${scenarios.length} scenarios`);
    
    if (scenarios.length > 0) {
      console.log('First scenario:', scenarios[0].title);
      console.log('Level:', scenarios[0].level);
      console.log('Description:', scenarios[0].description);
    }
    
    console.log('\n✅ SDK example completed successfully!');
    
  } catch (error) {
    console.error('❌ Error occurred:', error);
    
    // The SDK provides detailed error information
    if (error.body) {
      console.error('Error details:', error.body);
    }
  }
}

// Handle the async main function
if (require.main === module) {
  main().catch(console.error);
}

export { main };