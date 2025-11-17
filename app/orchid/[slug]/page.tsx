import { promises as fs } from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface OrchidData {
  name: string
  scientificName: string
  slug: string
  description?: string
  care?: {
    light?: string
    water?: string
    temperature?: string
    humidity?: string
    fertilizer?: string
    potting?: string
    blooming?: string
  }
  resources?: {
    websites?: Array<{ url: string; title: string }>
    videos?: Array<{ url: string; title: string }>
  }
}

async function getOrchid(slug: string): Promise<OrchidData | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'orchids', `${slug}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return null
  }
}

async function getAllOrchidSlugs(): Promise<string[]> {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'orchids')
    const files = await fs.readdir(dataDir)
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
  } catch (error) {
    return []
  }
}

export async function generateStaticParams() {
  const slugs = await getAllOrchidSlugs()
  return slugs.map((slug) => ({
    slug,
  }))
}

export default async function OrchidPage({ params }: { params: { slug: string } }) {
  const orchid = await getOrchid(params.slug)

  if (!orchid) {
    notFound()
  }

  return (
    <div>
      <Link href="/" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
        ← Back to all orchids
      </Link>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-4xl font-bold text-purple-600 mb-2">{orchid.name}</h1>
        <p className="text-xl text-gray-500 italic mb-6">{orchid.scientificName}</p>

        {orchid.description && (
          <div className="mb-8">
            <p className="text-gray-700">{orchid.description}</p>
          </div>
        )}

        {orchid.care && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Care Requirements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orchid.care.light && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">💡 Light</h3>
                  <p className="text-gray-700">{orchid.care.light}</p>
                </div>
              )}
              {orchid.care.water && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">💧 Water</h3>
                  <p className="text-gray-700">{orchid.care.water}</p>
                </div>
              )}
              {orchid.care.temperature && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-900 mb-2">🌡️ Temperature</h3>
                  <p className="text-gray-700">{orchid.care.temperature}</p>
                </div>
              )}
              {orchid.care.humidity && (
                <div className="bg-teal-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-teal-900 mb-2">💨 Humidity</h3>
                  <p className="text-gray-700">{orchid.care.humidity}</p>
                </div>
              )}
              {orchid.care.fertilizer && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">🌱 Fertilizer</h3>
                  <p className="text-gray-700">{orchid.care.fertilizer}</p>
                </div>
              )}
              {orchid.care.potting && (
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-amber-900 mb-2">🪴 Potting</h3>
                  <p className="text-gray-700">{orchid.care.potting}</p>
                </div>
              )}
              {orchid.care.blooming && (
                <div className="bg-pink-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-pink-900 mb-2">🌸 Blooming</h3>
                  <p className="text-gray-700">{orchid.care.blooming}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {orchid.resources && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Resources</h2>

            {orchid.resources.videos && orchid.resources.videos.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📺 Videos</h3>
                <ul className="space-y-2">
                  {orchid.resources.videos.map((video, index) => (
                    <li key={index}>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        {video.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {orchid.resources.websites && orchid.resources.websites.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🔗 Websites</h3>
                <ul className="space-y-2">
                  {orchid.resources.websites.map((website, index) => (
                    <li key={index}>
                      <a
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        {website.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
