"use client"

import {
  Briefcase,
  Car,
  Clock,
  CreditCard,
  Heart,
  Home,
  Layers,
  Music,
  Percent,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react"
import type { LucideProps } from "lucide-react"

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Briefcase,
  Car,
  Clock,
  CreditCard,
  Heart,
  Home,
  Layers,
  Music,
  Percent,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
}

export function CategoryIcon({
  icon,
  ...props
}: { icon: string | null | undefined } & LucideProps) {
  if (!icon) return null
  const Icon = ICON_MAP[icon]
  if (!Icon) return null
  return <Icon {...props} />
}
