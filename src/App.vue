<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useColorMode } from '@vueuse/core'
import BlackHoleBackground from '@/components/ui/bg-black-hole/BlackHoleBackground.vue'
import { CardSpotlight } from '@/components/ui/card-spotlight'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import docsConfig from '@/docs/config.json'

interface DocNavItem {
  label: string
  document?: string
  children?: DocNavItem[]
}

interface DocsConfig {
  sidebar: DocNavItem[]
}

interface DocMeta {
  slug: string
  label: string
}

const config = docsConfig as DocsConfig
const sidebarItems = config.sidebar ?? []

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const spotlightColor = computed(() => (isDark.value ? '#363636' : '#C9C9C9'))

const docsModules = import.meta.glob('@/docs/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const docsContentMap: Record<string, string> = {}
Object.entries(docsModules).forEach(([path, content]) => {
  const slug = path.split('/').pop()?.replace(/\.md$/, '')
  if (slug) {
    docsContentMap[slug] = content as string
  }
})

const docMetaMap = new Map<string, DocNavItem>()
function registerNavItem(item: DocNavItem) {
  if (item.document) {
    docMetaMap.set(item.document, item)
  }
  item.children?.forEach(registerNavItem)
}
sidebarItems.forEach(registerNavItem)

const orderedDocs: string[] = []
const visited = new Set<string>()

function collectDocuments(items: DocNavItem[]) {
  items.forEach((item) => {
    if (item.document && docsContentMap[item.document] && !visited.has(item.document)) {
      orderedDocs.push(item.document)
      visited.add(item.document)
    }
    if (item.children) {
      collectDocuments(item.children)
    }
  })
}

collectDocuments(sidebarItems)

Object.keys(docsContentMap).forEach((slug) => {
  if (!visited.has(slug)) {
    orderedDocs.push(slug)
    visited.add(slug)
  }
})

function findFirstDocument(items: DocNavItem[]): string | null {
  for (const item of items) {
    if (item.document && docsContentMap[item.document]) {
      return item.document
    }
    if (item.children) {
      const child = findFirstDocument(item.children)
      if (child) return child
    }
  }
  return null
}

const defaultDoc = findFirstDocument(sidebarItems) ?? Object.keys(docsContentMap)[0] ?? ''
const activeSlug = ref<string>(defaultDoc)

function scrollToDocsSection(behavior: ScrollBehavior = 'smooth') {
  nextTick(() => {
    document.getElementById('docs-section')?.scrollIntoView({ behavior, block: 'start' })
  })
}

function parseHash(): string | null {
  const hash = decodeURIComponent(window.location.hash)
  if (hash.startsWith('#docs/')) {
    const slug = hash.replace('#docs/', '').trim()
    if (slug && docsContentMap[slug]) {
      return slug
    }
  }
  return null
}

let suppressHashEvent = false

function setActiveDoc(slug: string) {
  if (!docsContentMap[slug]) return
  if (activeSlug.value !== slug) {
    activeSlug.value = slug
  }
  scrollToDocsSection()
}

function handleHashChange() {
  if (suppressHashEvent) {
    suppressHashEvent = false
    return
  }
  const slug = parseHash()
  if (slug) {
    setActiveDoc(slug)
  } else if (defaultDoc) {
    setActiveDoc(defaultDoc)
  }
}

onMounted(() => {
  const slug = parseHash()
  if (slug) {
    setActiveDoc(slug)
  }
  window.addEventListener('hashchange', handleHashChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', handleHashChange)
})

watch(activeSlug, (slug) => {
  if (!slug) return
  const target = `#docs/${slug}`
  if (window.location.hash !== target) {
    suppressHashEvent = true
    window.location.hash = target
  }
})

const activeTitle = computed(() => {
  if (!activeSlug.value) return '文档'
  return docMetaMap.get(activeSlug.value)?.label ?? activeSlug.value
})

const activeMarkdown = computed(() => {
  if (!activeSlug.value) return ''
  return docsContentMap[activeSlug.value] ?? ''
})

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMarkdown(src: string) {
  if (!src) return '<p>暂无内容。</p>'
  const lines = src.split(/\r?\n/)
  let html = ''
  let inList = false
  let inCode = false
  let codeLang = ''
  let codeBuffer: string[] = []
  let tableBuffer: string[] = []

  const closeList = () => {
    if (inList) {
      html += '</ul>'
      inList = false
    }
  }

  const closeCode = () => {
    if (inCode) {
      const code = escapeHtml(codeBuffer.join('\n'))
      const langAttr = codeLang ? ` data-lang="${codeLang}"` : ''
      html += `<pre class="code-block"><code${langAttr}>${code}</code></pre>`
      inCode = false
      codeBuffer = []
      codeLang = ''
    }
  }

  const isTableLine = (line: string) => {
    const trimmed = line.trim()
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')
  }

  const flushTable = () => {
    if (!tableBuffer.length) return
    const rows = tableBuffer
      .map((row) =>
        row
          .trim()
          .slice(1, -1)
          .split('|')
          .map((cell) => escapeHtml(cell.trim())),
      )
      .filter((cells) => cells.length)

    if (rows.length) {
      const header = rows[0] ?? []
      if (!header.length) {
        tableBuffer = []
        return
      }

      const alignmentRow = rows[1]
      const hasAlignment = alignmentRow?.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell)) ?? false
      const bodyRows = rows.slice(hasAlignment ? 2 : 1)

      html += '<table class="docs-table">'
      html += '<thead><tr>' + header.map((cell) => `<th>${cell}</th>`).join('') + '</tr></thead>'
      if (bodyRows.length) {
        html += '<tbody>'
        bodyRows.forEach((cells) => {
          html += '<tr>' + cells.map((cell) => `<td>${cell}</td>`).join('') + '</tr>'
        })
        html += '</tbody>'
      }
      html += '</table>'
    }

    tableBuffer = []
  }

  lines.forEach((rawLine) => {
    const line = rawLine
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList()
        flushTable()
        inCode = true
        codeLang = line.slice(3).trim()
        codeBuffer = []
      } else {
        closeCode()
      }
      return
    }

    if (inCode) {
      codeBuffer.push(line)
      return
    }

    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      flushTable()
      return
    }

    const headingMatch = /^#{1,6}\s+/.exec(trimmed)
    if (headingMatch) {
      closeList()
      flushTable()
      const level = headingMatch[0].trim().length
      const text = escapeHtml(trimmed.slice(level + 1))
      html += `<h${level}>${text}</h${level}>`
      return
    }

    if (trimmed.startsWith('- ')) {
      if (!inList) {
        closeList()
        flushTable()
        html += '<ul>'
        inList = true
      }
      const text = escapeHtml(trimmed.slice(2))
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      html += `<li>${text}</li>`
      return
    }

    if (isTableLine(line)) {
      closeList()
      tableBuffer.push(line)
      return
    }

    flushTable()

    closeList()
    const paragraph = escapeHtml(trimmed)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    html += `<p>${paragraph}</p>`
  })

  closeList()
  closeCode()
  flushTable()

  return html || '<p>暂无内容。</p>'
}

const renderedHtml = computed(() => renderMarkdown(activeMarkdown.value))

const docsAvailable = computed(() => Object.keys(docsContentMap).length > 0)

function getDocMeta(slug: string): DocMeta {
  return {
    slug,
    label: docMetaMap.get(slug)?.label ?? slug,
  }
}

const activeIndex = computed(() => orderedDocs.indexOf(activeSlug.value))

const prevDoc = computed<DocMeta | null>(() => {
  const idx = activeIndex.value
  if (idx > 0) {
    const slug = orderedDocs[idx - 1]
    return slug ? getDocMeta(slug) : null
  }
  return null
})

const nextDoc = computed<DocMeta | null>(() => {
  const idx = activeIndex.value
  if (idx !== -1 && idx < orderedDocs.length - 1) {
    const slug = orderedDocs[idx + 1]
    return slug ? getDocMeta(slug) : null
  }
  return null
})

function goToDoc(slug?: string) {
  if (!slug) return
  setActiveDoc(slug)
}
</script>

<template>
  <div class="dark min-h-dvh w-full bg-[#050416] text-white">
    <section class="relative h-dvh overflow-hidden">
      <BlackHoleBackground class="h-dvh w-full" stroke-color="#64748b" />
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <h1
          class="-translate-y-12 text-4xl font-semibold tracking-[0.2em] text-white/90 drop-shadow-2xl md:-translate-y-16 md:text-6xl"
        >
          AmethystOpen
        </h1>
      </div>
    </section>

    <section id="docs-section" class="relative z-10 border-t border-white/10 bg-[#050416] px-6 py-16 md:py-24">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-12 md:flex-row">
        <aside class="md:w-72">
          <div class="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Docs</h2>
            <nav class="mt-6 space-y-6 text-sm">
              <template v-for="section in sidebarItems" :key="section.label">
                <div class="space-y-2">
                  <button
                    v-if="section.document && docsContentMap[section.document]"
                    type="button"
                    class="w-full rounded-2xl border border-transparent px-3 py-2 text-left font-medium text-white/80 transition hover:border-white/20 hover:bg-white/10"
                    :class="{ 'border-white/40 bg-white/10 text-white': section.document === activeSlug }"
                    @click="setActiveDoc(section.document)"
                  >
                    {{ section.label }}
                  </button>
                  <p v-else class="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    {{ section.label }}
                  </p>
                  <ul v-if="section.children" class="space-y-1 pl-2">
                    <li v-for="child in section.children" :key="child.label">
                      <button
                        v-if="child.document && docsContentMap[child.document]"
                        type="button"
                        class="w-full rounded-xl px-3 py-2 text-left text-white/60 transition hover:bg-white/10 hover:text-white"
                        :class="{ 'bg-white/10 text-white': child.document === activeSlug }"
                        @click="setActiveDoc(child.document)"
                      >
                        {{ child.label }}
                      </button>
                      <span v-else class="block rounded-xl px-3 py-2 text-left text-white/40">
                        {{ child.label }}
                      </span>
                    </li>
                  </ul>
                </div>
              </template>
            </nav>
          </div>
        </aside>
        <div class="flex-1">
          <div class="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-purple-500/10 backdrop-blur">
            <header class="flex flex-col gap-2 border-b border-white/10 pb-6">
              <p class="text-xs uppercase tracking-[0.4em] text-white/50">#docs/{{ activeSlug }}</p>
              <h2 class="text-2xl font-semibold text-white md:text-3xl">{{ activeTitle }}</h2>
            </header>
            <template v-if="docsAvailable">
              <div class="docs-content mt-8" v-html="renderedHtml"></div>
              <div class="mt-12 grid gap-4 md:grid-cols-2">
                <template v-if="prevDoc">
                  <a
                    class="group block"
                    :href="`#docs/${prevDoc?.slug}`"
                    @click.prevent="goToDoc(prevDoc?.slug)"
                  >
                    <CardSpotlight
                      class="cursor-pointer items-start justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-lg shadow-purple-500/20 transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-purple-500/40"
                      slot-class="flex h-full w-full flex-col gap-2 text-left"
                      :gradient-color="spotlightColor"
                    >
                      <span class="text-xs uppercase tracking-[0.3em] text-white/50">上一篇</span>
                      <span class="text-lg font-semibold text-white">{{ prevDoc?.label }}</span>
                    </CardSpotlight>
                  </a>
                </template>
                <CardSpotlight
                  v-else
                  class="pointer-events-none items-start justify-center gap-3 rounded-3xl border border-white/5 bg-white/10 px-6 py-8 opacity-40"
                  slot-class="flex h-full w-full flex-col gap-2 text-left"
                  :gradient-color="spotlightColor"
                >
                  <span class="text-xs uppercase tracking-[0.3em] text-white/40">上一篇</span>
                  <span class="text-lg font-semibold text-white/40">没有更多内容</span>
                </CardSpotlight>

                <template v-if="nextDoc">
                  <a
                    class="group block"
                    :href="`#docs/${nextDoc?.slug}`"
                    @click.prevent="goToDoc(nextDoc?.slug)"
                  >
                    <CardSpotlight
                      class="cursor-pointer items-start justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-8 shadow-lg shadow-purple-500/20 transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-purple-500/40"
                      slot-class="flex h-full w-full flex-col gap-2 text-left"
                      :gradient-color="spotlightColor"
                    >
                      <span class="text-xs uppercase tracking-[0.3em] text-white/50">下一篇</span>
                      <span class="text-lg font-semibold text-white">{{ nextDoc?.label }}</span>
                    </CardSpotlight>
                  </a>
                </template>
                <CardSpotlight
                  v-else
                  class="pointer-events-none items-start justify-center gap-3 rounded-3xl border border-white/5 bg-white/10 px-6 py-8 opacity-40"
                  slot-class="flex h-full w-full flex-col gap-2 text-left"
                  :gradient-color="spotlightColor"
                >
                  <span class="text-xs uppercase tracking-[0.3em] text-white/40">下一篇</span>
                  <span class="text-lg font-semibold text-white/40">没有更多内容</span>
                </CardSpotlight>
              </div>
            </template>
            <div v-else class="mt-8 text-sm text-white/60">
              暂无可用文档，请在 <code class="rounded bg-white/10 px-1">docs/</code> 目录中添加 Markdown 文件。
            </div>
          </div>
        </div>
      </div>
    </section>
    <SmoothCursor />
  </div>
</template>

<style scoped>
:deep(.docs-content) {
  display: grid;
  gap: 1.5rem;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: rgba(226, 232, 240, 0.92);
}

:deep(.docs-content h1) {
  margin-top: 2.5rem;
  font-size: 1.875rem;
  font-weight: 600;
  color: #fff;
}

:deep(.docs-content h2) {
  margin-top: 2.25rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
}

:deep(.docs-content h3) {
  margin-top: 2rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
}

:deep(.docs-content p) {
  color: rgba(226, 232, 240, 0.92);
}

:deep(.docs-content ul) {
  margin: 0.5rem 0 0;
  padding-left: 1.5rem;
  display: grid;
  gap: 0.5rem;
  list-style: disc;
  color: rgba(226, 232, 240, 0.92);
}

:deep(.docs-content li) {
  line-height: 1.7;
}

:deep(.docs-content code) {
  padding: 0.125rem 0.375rem;
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-size: 0.75rem;
  color: rgb(167, 243, 208);
  background: rgba(255, 255, 255, 0.08);
}

:deep(.docs-content .code-block) {
  overflow-x: auto;
  padding: 1rem;
  border-radius: 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-size: 0.8rem;
  color: rgb(195, 255, 234);
  background: rgba(15, 23, 42, 0.78);
}

:deep(.docs-table) {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  overflow: hidden;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.6);
  box-shadow: 0 10px 40px rgba(45, 30, 90, 0.25);
}

:deep(.docs-table th),
:deep(.docs-table td) {
  padding: 0.75rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  text-align: left;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.95);
}

:deep(.docs-table th) {
  background: rgba(94, 234, 212, 0.08);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(226, 232, 240, 0.9);
}
</style>
