#!/usr/bin/env node

/**
 * Qdrant Ingestion Script
 *
 * This script ingests the fetched resources into Qdrant vector database.
 * It chunks the content, generates embeddings using Ollama, and stores them in Qdrant.
 *
 * Features:
 * - Chunks large content into manageable pieces
 * - Generates embeddings using Ollama (nomic-embed-text)
 * - Stores in Qdrant with metadata for filtering
 * - Supports incremental updates
 */

const fs = require('fs').promises;
const path = require('path');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OllamaEmbeddings } = require('@langchain/ollama');

// Configuration
require('dotenv').config();
const RESOURCES_DIR = path.join(__dirname, '../data/resources');
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'orchid_care_resources';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000');
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '200');

let qdrantClient;
let embeddings;

/**
 * Initialize Qdrant client and embeddings
 */
async function initialize() {
  console.log('Initializing Qdrant client...');
  qdrantClient = new QdrantClient({ url: QDRANT_URL });

  console.log('Initializing Ollama embeddings...');
  embeddings = new OllamaEmbeddings({
    model: EMBEDDING_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });

  // Test connection
  try {
    await qdrantClient.getCollections();
    console.log('✓ Connected to Qdrant');
  } catch (error) {
    throw new Error(`Could not connect to Qdrant at ${QDRANT_URL}. Make sure Qdrant is running (docker-compose up -d)`);
  }

  // Test Ollama embeddings
  try {
    await embeddings.embedQuery('test');
    console.log(`✓ Connected to Ollama embeddings (${EMBEDDING_MODEL})`);
  } catch (error) {
    console.error(`✗ Could not connect to Ollama or model not found`);
    console.error(`  Make sure Ollama is running and pull the model:`);
    console.error(`  ollama pull ${EMBEDDING_MODEL}`);
    throw error;
  }
}

/**
 * Create or recreate the Qdrant collection
 */
async function setupCollection() {
  console.log(`\nSetting up collection: ${QDRANT_COLLECTION}`);

  try {
    // Check if collection exists
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === QDRANT_COLLECTION);

    if (exists) {
      console.log('  Collection already exists. Deleting and recreating...');
      await qdrantClient.deleteCollection(QDRANT_COLLECTION);
    }

    // Get embedding dimension by generating a test embedding
    const testEmbedding = await embeddings.embedQuery('test');
    const dimension = testEmbedding.length;
    console.log(`  Embedding dimension: ${dimension}`);

    // Create collection
    await qdrantClient.createCollection(QDRANT_COLLECTION, {
      vectors: {
        size: dimension,
        distance: 'Cosine',
      },
    });

    console.log('✓ Collection created successfully');
  } catch (error) {
    console.error('✗ Error setting up collection:', error.message);
    throw error;
  }
}

/**
 * Chunk text content
 */
async function chunkContent(content) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const chunks = await splitter.createDocuments([content]);
  return chunks.map(chunk => chunk.pageContent);
}

/**
 * Process and ingest resources for a single orchid
 */
async function ingestOrchidResources(resourceFile) {
  const filePath = path.join(RESOURCES_DIR, resourceFile);
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

  console.log(`\nProcessing: ${data.orchid.name}`);

  if (!data.resources || data.resources.length === 0) {
    console.log('  ⚠ No resources to ingest');
    return { orchid: data.orchid, chunks: 0 };
  }

  let totalChunks = 0;
  const points = [];

  // Process each resource
  for (const resource of data.resources) {
    console.log(`  Processing ${resource.type}: ${resource.title}`);

    // Chunk the content
    const chunks = await chunkContent(resource.content);
    console.log(`    Created ${chunks.length} chunks`);

    // Generate embeddings and prepare points
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embeddings.embedQuery(chunk);

      const point = {
        id: `${data.orchid.slug}_${resource.type}_${Date.now()}_${i}`,
        vector: embedding,
        payload: {
          orchidName: data.orchid.name,
          orchidScientificName: data.orchid.scientificName,
          orchidSlug: data.orchid.slug,
          resourceType: resource.type,
          resourceUrl: resource.url,
          resourceTitle: resource.title,
          priority: resource.priority || 'normal',
          content: chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          timestamp: resource.timestamp,
        }
      };

      points.push(point);
      totalChunks++;
    }

    // Small delay to avoid overwhelming Ollama
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Upload points to Qdrant in batches
  console.log(`  Uploading ${points.length} points to Qdrant...`);
  const batchSize = 100;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await qdrantClient.upsert(QDRANT_COLLECTION, {
      wait: true,
      points: batch,
    });
  }

  console.log(`  ✓ Ingested ${totalChunks} chunks from ${data.resources.length} resources`);

  return { orchid: data.orchid, chunks: totalChunks };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Qdrant Ingestion Script ===\n');

  try {
    // Initialize
    await initialize();

    // Setup collection
    await setupCollection();

    // Get all resource files
    console.log('\nReading resource files...');
    const files = await fs.readdir(RESOURCES_DIR);
    const resourceFiles = files.filter(f => f.endsWith('.json'));
    console.log(`Found ${resourceFiles.length} resource files\n`);

    if (resourceFiles.length === 0) {
      console.log('⚠ No resource files found. Run: npm run fetch-resources');
      return;
    }

    // Process each resource file
    const results = [];
    for (const file of resourceFiles) {
      const result = await ingestOrchidResources(file);
      results.push(result);
    }

    // Summary
    console.log('\n=== Summary ===');
    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
    console.log(`✓ Processed ${results.length} orchid species`);
    console.log(`✓ Ingested ${totalChunks} total chunks into Qdrant`);
    console.log(`✓ Collection: ${QDRANT_COLLECTION}`);
    console.log(`✓ Qdrant Dashboard: ${QDRANT_URL}/dashboard`);

    console.log('\nNext steps:');
    console.log('1. Browse the Qdrant dashboard to explore the data');
    console.log('2. Run: npm run generate-content');
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    process.exit(1);
  }
}

main();
