#!/usr/bin/env node

/**
 * Resource Fetching Script
 *
 * This script fetches content from YouTube videos and websites for each orchid species.
 * The fetched content will be stored in JSON files for later ingestion into Qdrant.
 *
 * Features:
 * - Fetches YouTube video transcripts
 * - Scrapes website content
 * - Prioritizes user-provided custom resources
 * - Searches for additional resources automatically
 */

const fs = require('fs').promises;
const path = require('path');
const { YoutubeTranscript } = require('youtube-transcript');
const cheerio = require('cheerio');

// Configuration
require('dotenv').config();
const ORCHIDS_LIST_PATH = path.join(__dirname, '../data/orchids-list.md');
const RESOURCES_DIR = path.join(__dirname, '../data/resources');
const MAX_RESOURCES = parseInt(process.env.MAX_RESOURCES_PER_ORCHID || '5');

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
        customVideos: [],
        customWebsites: [],
        description: ''
      };
    } else if (line.match(/^-\s+Videos?:/i) && currentOrchid) {
      const urls = line.split(':')[1].split(',').map(u => u.trim()).filter(u => u);
      currentOrchid.customVideos.push(...urls);
    } else if (line.match(/^-\s+Websites?:/i) && currentOrchid) {
      const urls = line.split(':')[1].split(',').map(u => u.trim()).filter(u => u);
      currentOrchid.customWebsites.push(...urls);
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
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Fetch YouTube video transcript
 */
async function fetchYouTubeTranscript(videoUrl) {
  try {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      console.log(`    ✗ Invalid YouTube URL: ${videoUrl}`);
      return null;
    }

    console.log(`    Fetching transcript for video: ${videoId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      console.log(`    ✗ No transcript available for video: ${videoId}`);
      return null;
    }

    // Combine transcript segments
    const text = transcript.map(item => item.text).join(' ');

    console.log(`    ✓ Fetched transcript (${text.length} characters)`);
    return {
      url: videoUrl,
      videoId: videoId,
      type: 'youtube',
      title: `YouTube Video ${videoId}`,
      content: text,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log(`    ✗ Error fetching transcript: ${error.message}`);
    return null;
  }
}

/**
 * Fetch website content
 */
async function fetchWebsiteContent(url) {
  try {
    console.log(`    Fetching website: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.log(`    ✗ HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script, style, and navigation elements
    $('script, style, nav, header, footer, iframe').remove();

    // Get page title
    const title = $('title').text().trim() || 'Untitled Page';

    // Extract main content
    let content = '';

    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }

    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (content.length < 100) {
      console.log(`    ✗ Insufficient content from ${url}`);
      return null;
    }

    console.log(`    ✓ Fetched website content (${content.length} characters)`);
    return {
      url: url,
      type: 'website',
      title: title,
      content: content,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.log(`    ✗ Error fetching website: ${error.message}`);
    return null;
  }
}

/**
 * Generate suggested search queries and URLs
 */
function generateSuggestedResources(orchid) {
  const suggestions = {
    videos: [
      `https://www.youtube.com/results?search_query=${encodeURIComponent(orchid.name + ' orchid care guide')}`,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(orchid.scientificName + ' care')}`
    ],
    websites: [
      'https://www.aos.org/orchids/orchid-care.aspx',
      `https://www.google.com/search?q=${encodeURIComponent(orchid.name + ' orchid care guide')}`,
      'https://www.repotme.com/orchid-care',
      'https://orchidbliss.com/',
      'https://www.orchidweb.com/'
    ]
  };

  return suggestions;
}

/**
 * Process a single orchid
 */
async function processOrchid(orchid) {
  console.log(`\nProcessing: ${orchid.name} (${orchid.scientificName})`);

  const resources = [];

  // Fetch custom YouTube videos
  console.log(`  Custom videos: ${orchid.customVideos.length}`);
  for (const videoUrl of orchid.customVideos) {
    const resource = await fetchYouTubeTranscript(videoUrl);
    if (resource) {
      resource.priority = 'high';
      resource.orchidName = orchid.name;
      resource.orchidScientificName = orchid.scientificName;
      resource.orchidSlug = orchid.slug;
      resources.push(resource);
    }
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Fetch custom websites
  console.log(`  Custom websites: ${orchid.customWebsites.length}`);
  for (const websiteUrl of orchid.customWebsites) {
    const resource = await fetchWebsiteContent(websiteUrl);
    if (resource) {
      resource.priority = 'high';
      resource.orchidName = orchid.name;
      resource.orchidScientificName = orchid.scientificName;
      resource.orchidSlug = orchid.slug;
      resources.push(resource);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate suggestions for manual searching
  const suggestions = generateSuggestedResources(orchid);

  // Save resources to file
  const outputPath = path.join(RESOURCES_DIR, `${orchid.slug}.json`);
  await fs.writeFile(outputPath, JSON.stringify({
    orchid: {
      name: orchid.name,
      scientificName: orchid.scientificName,
      slug: orchid.slug
    },
    resources: resources,
    suggestions: suggestions,
    fetchedAt: new Date().toISOString()
  }, null, 2));

  console.log(`  ✓ Saved ${resources.length} resources to ${orchid.slug}.json`);

  if (resources.length === 0) {
    console.log(`  ⚠ No resources fetched. Add custom URLs to data/orchids-list.md`);
    console.log(`    Suggested video search: ${suggestions.videos[0]}`);
    console.log(`    Suggested websites: American Orchid Society, RepotMe, OrchidBliss`);
  }

  return { orchid, resourceCount: resources.length };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Orchid Resource Fetcher ===\n');

  // Create resources directory
  await fs.mkdir(RESOURCES_DIR, { recursive: true });

  // Parse orchids list
  console.log('Reading orchids list...');
  const orchids = await parseOrchidsList();
  console.log(`Found ${orchids.length} orchid species\n`);

  // Process each orchid
  const results = [];
  for (const orchid of orchids) {
    const result = await processOrchid(orchid);
    results.push(result);
  }

  // Summary
  console.log('\n=== Summary ===');
  const totalResources = results.reduce((sum, r) => sum + r.resourceCount, 0);
  console.log(`✓ Processed ${orchids.length} orchid species`);
  console.log(`✓ Fetched ${totalResources} total resources`);
  console.log(`✓ Saved to: ${RESOURCES_DIR}`);

  console.log('\nNext steps:');
  console.log('1. Review fetched resources in data/resources/');
  console.log('2. Add more custom URLs to data/orchids-list.md if needed');
  console.log('3. Run: npm run ingest-to-qdrant');
}

main().catch(error => {
  console.error('\n=== Error ===');
  console.error(error);
  process.exit(1);
});
