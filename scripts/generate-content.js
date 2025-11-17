#!/usr/bin/env node

/**
 * Orchid Care Guide Content Generator
 *
 * This script reads the orchids-list.md file and generates detailed care information
 * for each orchid species using LangChain and Ollama.
 *
 * Prerequisites:
 * - Ollama running locally (ollama serve)
 * - At least one model installed (e.g., ollama pull llama3.2)
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const ORCHIDS_LIST_PATH = path.join(__dirname, '../data/orchids-list.md');
const OUTPUT_DIR = path.join(__dirname, '../data/orchids');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

/**
 * Parse the orchids-list.md file to extract orchid species
 */
async function parseOrchidsList() {
  try {
    const content = await fs.readFile(ORCHIDS_LIST_PATH, 'utf-8');
    const lines = content.split('\n');
    const orchids = [];

    let currentOrchid = null;

    for (const line of lines) {
      // Match orchid entries: ### Name (*Scientific Name*)
      const orchidMatch = line.match(/^###\s+(.+?)\s+\(([^)]+)\)/);
      if (orchidMatch) {
        if (currentOrchid) {
          orchids.push(currentOrchid);
        }

        const commonName = orchidMatch[1].trim();
        const scientificName = orchidMatch[2].replace(/\*/g, '').trim();

        currentOrchid = {
          name: commonName,
          scientificName: scientificName,
          slug: generateSlug(commonName),
          customVideos: [],
          customWebsites: [],
          description: ''
        };
      }
      // Match custom videos
      else if (line.match(/^-\s+Videos?:/i) && currentOrchid) {
        const urls = line.split(':')[1].split(',').map(u => u.trim()).filter(u => u);
        currentOrchid.customVideos.push(...urls);
      }
      // Match custom websites
      else if (line.match(/^-\s+Websites?:/i) && currentOrchid) {
        const urls = line.split(':')[1].split(',').map(u => u.trim()).filter(u => u);
        currentOrchid.customWebsites.push(...urls);
      }
      // Collect description (non-empty lines that aren't headers or lists)
      else if (currentOrchid && line.trim() && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
        if (currentOrchid.description) {
          currentOrchid.description += ' ';
        }
        currentOrchid.description += line.trim();
      }
    }

    if (currentOrchid) {
      orchids.push(currentOrchid);
    }

    return orchids;
  } catch (error) {
    console.error('Error parsing orchids list:', error.message);
    throw error;
  }
}

/**
 * Generate a URL-friendly slug from a name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Call Ollama API to generate care information
 */
async function generateCareInfo(orchid) {
  const prompt = `You are an expert orchid grower. Provide detailed care information for ${orchid.name} (${orchid.scientificName}).

Please provide specific care requirements in the following categories. Be concise but informative (2-3 sentences per category):

1. Light: Describe the ideal lighting conditions
2. Water: Explain watering frequency and methods
3. Temperature: Specify ideal temperature ranges
4. Humidity: Detail humidity requirements
5. Fertilizer: Describe fertilization schedule and type
6. Potting: Explain potting medium and repotting guidance
7. Blooming: Describe blooming season and tips

Format your response as valid JSON with this exact structure:
{
  "light": "your detailed answer here",
  "water": "your detailed answer here",
  "temperature": "your detailed answer here",
  "humidity": "your detailed answer here",
  "fertilizer": "your detailed answer here",
  "potting": "your detailed answer here",
  "blooming": "your detailed answer here"
}

Only return the JSON object, no other text.`;

  try {
    console.log(`  Generating care info with Ollama (${OLLAMA_MODEL})...`);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        format: 'json'
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const careInfo = JSON.parse(data.response);

    return careInfo;
  } catch (error) {
    console.error(`  Error generating care info: ${error.message}`);
    console.log('  Using fallback care information...');

    // Fallback care information
    return {
      light: 'Bright, indirect light is generally preferred. Adjust based on specific species requirements.',
      water: 'Water when the potting medium is nearly dry. Frequency varies by species and environment.',
      temperature: 'Most orchids prefer temperatures between 60-80°F (15-27°C).',
      humidity: '50-70% humidity is ideal for most orchid species.',
      fertilizer: 'Feed regularly during growing season with diluted orchid fertilizer.',
      potting: 'Use well-draining orchid mix. Repot when medium breaks down or plant outgrows pot.',
      blooming: 'Blooming depends on species. Provide proper care and environmental conditions.'
    };
  }
}

/**
 * Generate suggested search queries for finding resources
 */
function generateSearchQueries(orchid) {
  return {
    videos: [
      `${orchid.name} ${orchid.scientificName} care guide`,
      `how to grow ${orchid.name} orchid`,
      `${orchid.scientificName} watering and care`
    ],
    websites: [
      `${orchid.name} care guide`,
      `${orchid.scientificName} growing tips`,
      `${orchid.name} orchid maintenance`
    ]
  };
}

/**
 * Process a single orchid and generate its care guide
 */
async function processOrchid(orchid) {
  console.log(`\nProcessing: ${orchid.name} (${orchid.scientificName})`);

  // Generate care information using Ollama
  const careInfo = await generateCareInfo(orchid);

  // Prepare resources
  const resources = {
    videos: [],
    websites: []
  };

  // Add custom videos (prioritized)
  orchid.customVideos.forEach(url => {
    resources.videos.push({
      url: url,
      title: `${orchid.name} Care Video`
    });
  });

  // Add custom websites (prioritized)
  orchid.customWebsites.forEach(url => {
    resources.websites.push({
      url: url,
      title: `${orchid.name} Care Guide`
    });
  });

  // Generate search suggestions for finding more resources
  const searchQueries = generateSearchQueries(orchid);
  console.log(`  Suggested video searches: ${searchQueries.videos.join(', ')}`);
  console.log(`  Suggested website searches: ${searchQueries.websites.join(', ')}`);

  // Add some default reliable resources if no custom ones provided
  if (resources.websites.length === 0) {
    resources.websites.push({
      url: 'https://www.aos.org/orchids/orchid-care.aspx',
      title: 'American Orchid Society - General Care Guide'
    });
  }

  // Create the final data structure
  const orchidData = {
    name: orchid.name,
    scientificName: orchid.scientificName,
    slug: orchid.slug,
    description: orchid.description || `${orchid.name} is a beautiful orchid species that requires proper care to thrive.`,
    care: careInfo,
    resources: resources,
    searchQueries: searchQueries // Include for manual searching
  };

  // Save to file
  const outputPath = path.join(OUTPUT_DIR, `${orchid.slug}.json`);
  await fs.writeFile(outputPath, JSON.stringify(orchidData, null, 2));
  console.log(`  ✓ Saved to ${orchid.slug}.json`);

  return orchidData;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Orchid Care Guide Content Generator ===\n');

  // Check if Ollama is available
  console.log('Checking Ollama connection...');
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      const models = data.models || [];
      console.log(`✓ Connected to Ollama (${models.length} models available)`);

      const hasModel = models.some(m => m.name.includes(OLLAMA_MODEL.split(':')[0]));
      if (!hasModel) {
        console.warn(`⚠ Model '${OLLAMA_MODEL}' not found. Available models:`, models.map(m => m.name).join(', '));
        console.warn(`  You can pull a model with: ollama pull ${OLLAMA_MODEL}`);
      }
    } else {
      throw new Error('Ollama not responding');
    }
  } catch (error) {
    console.error('✗ Could not connect to Ollama');
    console.error('  Make sure Ollama is running: ollama serve');
    console.error('  Or set OLLAMA_BASE_URL environment variable');
    console.error(`  Error: ${error.message}\n`);
    console.log('Continuing anyway (will use fallback data)...\n');
  }

  // Create output directory if it doesn't exist
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Parse orchids list
  console.log('Reading orchids list...');
  const orchids = await parseOrchidsList();
  console.log(`Found ${orchids.length} orchid species\n`);

  // Process each orchid
  const results = [];
  for (const orchid of orchids) {
    const result = await processOrchid(orchid);
    results.push(result);

    // Small delay to avoid overwhelming Ollama
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  console.log(`✓ Generated care guides for ${results.length} orchid species`);
  console.log(`✓ Files saved to: ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Review the generated files in data/orchids/');
  console.log('2. Add custom YouTube videos and websites to data/orchids-list.md');
  console.log('3. Re-run this script to update with custom resources');
  console.log('4. Run the Next.js app: npm run dev');
}

// Run the script
main().catch(error => {
  console.error('\n=== Error ===');
  console.error(error);
  process.exit(1);
});
