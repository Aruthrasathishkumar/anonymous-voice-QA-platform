import RoomClient from './RoomClient'

export function generateStaticParams() {
  return [{ code: '_' }]
}

export default function Page() {
  return <RoomClient />
}
