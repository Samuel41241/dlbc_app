import { db } from '@/lib/db'

export async function POST(req: Request) {
  const { userId } = await req.json()

  await db.profile.update({
    where: { id: userId },
    data: {
      isLocked: false,
      failedLoginAttempts: 0
    }
  })

  return Response.json({ success: true })
}