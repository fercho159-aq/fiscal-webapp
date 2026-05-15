import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sintesis = await prisma.sintesis.findFirst({
    where: { id, caso: { userId: session.user.id } },
    select: { id: true },
  });
  if (!sintesis) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.sintesis.delete({ where: { id: sintesis.id } });
  return NextResponse.json({ ok: true, id });
}

export const runtime = "nodejs";
