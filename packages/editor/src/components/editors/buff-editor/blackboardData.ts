import type { BlackboardManifest, BlackboardShard } from './blackboardModel'

let manifestPromise: Promise<BlackboardManifest> | undefined
const shards = new Map<string, Promise<BlackboardShard>>()

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}buff-blackboard/${path}`)
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) throw new Error(`黑板数据加载失败（${response.status}）`)
  return response.json()
}

export function loadBlackboardManifest() {
  if (!manifestPromise) manifestPromise = getJson<BlackboardManifest>('manifest.json').then(data => {
    if (data.schemaVersion !== 1 || !data.templates || !data.coverage) throw new Error('黑板索引版本不兼容')
    return data
  }).catch(error => { manifestPromise = undefined; throw error })
  return manifestPromise
}

export async function loadTemplateBlackboard(key: string) {
  const manifest = await loadBlackboardManifest()
  const file = manifest.templates[key]
  if (!file) return { manifest, shard: { sources: {}, templates: {} } as BlackboardShard }
  if (!/^[\w-]+\.json$/.test(file)) throw new Error('黑板分片路径无效')
  let pending = shards.get(file)
  if (!pending) {
    pending = getJson<BlackboardShard>(file).catch(error => {
      shards.delete(file)
      // A deployment can replace the manifest while this tab still has the old
      // one. Retry its normal cached URL as well; no timestamp/cache bypass.
      manifestPromise = undefined
      throw error
    })
    shards.set(file, pending)
  }
  const shard = await pending
  if (!shard.sources || !shard.templates) { shards.delete(file); throw new Error('黑板分片格式无效') }
  return { manifest, shard }
}
