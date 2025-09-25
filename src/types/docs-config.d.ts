declare module '@/docs/config.json' {
  interface DocNavItemConfig {
    label: string
    document?: string
    children?: DocNavItemConfig[]
  }

  const value: {
    sidebar: DocNavItemConfig[]
  }

  export default value
}
