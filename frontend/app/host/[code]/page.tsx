import HostClient from './HostClient'

export function generateStaticParams() {
  return [{ code: '_' }]
}

export default function Page() {
  return <HostClient />
}
