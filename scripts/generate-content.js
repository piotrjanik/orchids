#!/usr/bin/env node

/**
 * Orchid Care Guide Content Generator with RAG
 *
 * This script generates detailed care information for each orchid species using
 * Retrieval-Augmented Generation (RAG) with LangChain, Qdrant, and Ollama.
 *
 * It retrieves relevant information from the vector database and uses it to
 * generate accurate, evidence-based care guides.
 */

const fs = require('fs').promises;
const path = require('path');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { OllamaEmbeddings } = require('@langchain/ollama');
const { Ollama } = require('@langchain/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');

// Configuration
require('dotenv').config();
const ORCHIDS_LIST_PATH = path.join(__dirname, '../data/orchids-list.md');
const OUTPUT_DIR = path.join(__dirname, '../data/orchids');
const RESOURCES_DIR = path.join(__dirname, '../data/resources');
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'orchid_care_resources';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

let qdrantClient;
let embeddings;
let llm;

/**
 * Initialize clients
 */
async function initialize() {
  console.log('Initializing Qdrant client...');
  qdrantClient = new QdrantClient({ url: QDRANT_URL });

  console.log('Initializing Ollama embeddings...');
  embeddings = new OllamaEmbeddings({
    model: EMBEDDING_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });

  console.log('Initializing Ollama LLM...');
  llm = new Ollama({
    model: OLLAMA_MODEL,
    baseUrl: OLLAMA_BASE_URL,
    temperature: 0.7,
  });

  // Test connections
  try {
    await qdrantClient.getCollections();
    console.log('✓ Connected to Qdrant');
  } catch (error) {
    console.error('✗ Could not connect to Qdrant');
    throw error;
  }

  try {
    await embeddings.embedQuery('test');
    console.log(`✓ Ollama embeddings ready (${EMBEDDING_MODEL})`);
  } catch (error) {
    console.error(`✗ Could not connect to Ollama embeddings`);
    console.error(`  Run: ollama pull ${EMBEDDING_MODEL}`);
    throw error;
  }

  try {
    await llm.invoke('test');
    console.log(`✓ Ollama LLM ready (${OLLAMA_MODEL})`);
  } catch (error) {
    console.error(`✗ Could not connect to Ollama LLM`);
    console.error(`  Run: ollama pull ${OLLAMA_MODEL}`);
    throw error;
  }
}

/**
 * Parse the orchids-list.md file
 */
async function parseOrchidsList() {
  const content = await fs.readFile(ORCHIDS_LIST_PATH, 'utf-8');
  const lines = content.split('\n');
  const orchids = [];
  let currentOrchid = null;

  for (const line of lines) {
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
        description: ''
      };
    } else if (currentOrchid && line.trim() && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
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
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Retrieve relevant information from Qdrant for an orchid
 */
async function retrieveOrchidInfo(orchid, query, limit = 10) {
  try {
    // Generate query embedding
    const queryEmbedding = await embeddings.embedQuery(query);

    // Search in Qdrant with filter for specific orchid
    const searchResults = await qdrantClient.search(QDRANT_COLLECTION, {
      vector: queryEmbedding,
      limit: limit,
      filter: {
        must: [
          {
            key: 'orchidSlug',
            match: { value: orchid.slug }
          }
        ]
      },
      with_payload: true,
    });

    return searchResults.map(result => ({
      content: result.payload.content,
      score: result.score,
      source: result.payload.resourceUrl,
      title: result.payload.resourceTitle,
      type: result.payload.resourceType,
      priority: result.payload.priority
    }));
  } catch (error) {
    console.error(`    Error retrieving info: ${error.message}`);
    return [];
  }
}

/**
 * Generate care information using RAG
 */
async function generateCareInfoWithRAG(orchid) {
  console.log(`  Generating care information with RAG...`);

  // Retrieve relevant information for different care aspects
  const queries = [
    `${orchid.name} ${orchid.scientificName} light requirements lighting conditions`,
    `${orchid.name} ${orchid.scientificName} watering schedule water frequency`,
    `${orchid.name} ${orchid.scientificName} temperature requirements`,
    `${orchid.name} ${orchid.scientificName} humidity requirements`,
    `${orchid.name} ${orchid.scientificName} fertilizer feeding schedule`,
    `${orchid.name} ${orchid.scientificName} potting medium repotting`,
    `${orchid.name} ${orchid.scientificName} blooming flowering tips`
  ];

  console.log(`    Retrieving information from vector database...`);
  const allRetrievedInfo = [];

  for (const query of queries) {
    const results = await retrieveOrchidInfo(orchid, query, 5);
    allRetrievedInfo.push(...results);
  }

  // Remove duplicates based on content
  const uniqueInfo = allRetrievedInfo.filter((item, index, self) =>
    index === self.findIndex(t => t.content === item.content)
  );

  console.log(`    Retrieved ${uniqueInfo.length} unique information chunks`);

  if (uniqueInfo.length === 0) {
    console.log(`    ⚠ No information found in vector database`);
    console.log(`    Using fallback information...`);
    return generateFallbackCareInfo(orchid);
  }

  // Prepare context from retrieved information
  const context = uniqueInfo
    .map((info, i) => `[Source ${i + 1} - ${info.type} - ${info.title}]:\n${info.content}`)
    .join('\n\n');

  // Create prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`You are an expert orchid grower. Based on the following information retrieved from trusted sources about {orchidName} ({scientificName}), provide detailed care requirements.

IMPORTANT: Base your response ONLY on the information provided in the sources below. Do not make up information.

Retrieved Information:
{context}

Please provide care requirements in the following categories (2-3 sentences each). If information for a category is not available in the sources, say "Information not available in sources" for that category:

1. Light
2. Water
3. Temperature
4. Humidity
5. Fertilizer
6. Potting
7. Blooming

Format your response as valid JSON with this exact structure:
{{
  "light": "your answer here",
  "water": "your answer here",
  "temperature": "your answer here",
  "humidity": "your answer here",
  "fertilizer": "your answer here",
  "potting": "your answer here",
  "blooming": "your answer here"
}}

Only return the JSON object, no other text.`);

  const prompt = await promptTemplate.format({
    orchidName: orchid.name,
    scientificName: orchid.scientificName,
    context: context
  });

  // Generate response
  console.log(`    Generating care guide with ${OLLAMA_MODEL}...`);
  const response = await llm.invoke(prompt);

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const careInfo = JSON.parse(jsonMatch[0]);

    // Add source information
    const sources = uniqueInfo
      .filter((info, index, self) =>
        index === self.findIndex(t => t.source === info.source)
      )
      .map(info => ({
        url: info.source,
        title: info.title,
        type: info.type,
        priority: info.priority
      }));

    return { careInfo, sources };
  } catch (error) {
    console.error(`    Error parsing LLM response: ${error.message}`);
    console.log(`    Using fallback information...`);
    return generateFallbackCareInfo(orchid);
  }
}

/**
 * Generate fallback care information
 */
function generateFallbackCareInfo(orchid) {
  return {
    careInfo: {
      light: 'Bright, indirect light is generally preferred. Adjust based on specific species requirements.',
      water: 'Water when the potting medium is nearly dry. Frequency varies by species and environment.',
      temperature: 'Most orchids prefer temperatures between 60-80°F (15-27°C).',
      humidity: '50-70% humidity is ideal for most orchid species.',
      fertilizer: 'Feed regularly during growing season with diluted orchid fertilizer.',
      potting: 'Use well-draining orchid mix. Repot when medium breaks down or plant outgrows pot.',
      blooming: 'Blooming depends on species. Provide proper care and environmental conditions.'
    },
    sources: []
  };
}

/**
 * Load resources metadata
 */
async function loadResourcesMetadata(orchid) {
  try {
    const resourcePath = path.join(RESOURCES_DIR, `${orchid.slug}.json`);
    const data = JSON.parse(await fs.readFile(resourcePath, 'utf-8'));

    const resources = {
      videos: [],
      websites: []
    };

    if (data.resources) {
      for (const resource of data.resources) {
        if (resource.type === 'youtube') {
          resources.videos.push({
            url: resource.url,
            title: resource.title
          });
        } else if (resource.type === 'website') {
          resources.websites.push({
            url: resource.url,
            title: resource.title
          });
        }
      }
    }

    return resources;
  } catch (error) {
    return { videos: [], websites: [] };
  }
}

/**
 * Process a single orchid
 */
async function processOrchid(orchid) {
  console.log(`\nProcessing: ${orchid.name} (${orchid.scientificName})`);

  // Generate care information using RAG
  const { careInfo, sources } = await generateCareInfoWithRAG(orchid);

  // Load resources metadata
  const resources = await loadResourcesMetadata(orchid);

  // Merge sources into resources
  for (const source of sources) {
    if (source.type === 'youtube' && !resources.videos.find(v => v.url === source.url)) {
      resources.videos.push({ url: source.url, title: source.title });
    } else if (source.type === 'website' && !resources.websites.find(w => w.url === source.url)) {
      resources.websites.push({ url: source.url, title: source.title });
    }
  }

  // Create the final data structure
  const orchidData = {
    name: orchid.name,
    scientificName: orchid.scientificName,
    slug: orchid.slug,
    description: orchid.description || `${orchid.name} is a beautiful orchid species that requires proper care to thrive.`,
    care: careInfo,
    resources: resources,
    generatedAt: new Date().toISOString(),
    generatedWith: 'RAG (Qdrant + Ollama)'
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
  console.log('=== Orchid Care Guide Content Generator (RAG) ===\n');

  try {
    // Initialize
    await initialize();

    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Parse orchids list
    console.log('\nReading orchids list...');
    const orchids = await parseOrchidsList();
    console.log(`Found ${orchids.length} orchid species\n`);

    // Process each orchid
    const results = [];
    for (const orchid of orchids) {
      const result = await processOrchid(orchid);
      results.push(result);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== Summary ===');
    console.log(`✓ Generated care guides for ${results.length} orchid species`);
    console.log(`✓ Files saved to: ${OUTPUT_DIR}`);
    console.log('\nNext steps:');
    console.log('1. Review the generated files in data/orchids/');
    console.log('2. Run the Next.js app: npm run dev');
    console.log('3. Build for production: npm run build');
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    process.exit(1);
  }
}

main();
