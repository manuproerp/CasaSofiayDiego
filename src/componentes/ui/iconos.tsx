import {
  Airplane, Baby, Bank, Barbell, Basket, BookOpen, Broom, Bus, Cake, Car, Cat, Coffee, Coins, CreditCard,
  DeviceMobile, Dog, Drop, FilmSlate, FirstAid, ForkKnife, GameController, GasPump, Gift, GraduationCap,
  Hamburger, HandCoins, Heart, HouseLine, Lightbulb, Lightning, MusicNotes, PawPrint, PiggyBank, Pill, Plant,
  Receipt, Scissors, Shield, ShoppingCart, Storefront, Tag, Television, Toolbox, TShirt, Umbrella, WifiHigh,
  Wine, Wrench, type Icon,
} from '@phosphor-icons/react'

/** Íconos disponibles para categorías. La clave se guarda en la base de datos. */
export const ICONOS_CATEGORIA: Record<string, Icon> = {
  ShoppingCart, Basket, ForkKnife, Hamburger, Coffee, Wine, Cake,
  HouseLine, Lightning, Drop, WifiHigh, DeviceMobile, Television, Lightbulb, Broom, Wrench, Toolbox, Plant,
  Car, GasPump, Bus, Airplane,
  FirstAid, Pill, Heart, Barbell, Scissors,
  GraduationCap, BookOpen, Baby,
  PawPrint, Dog, Cat,
  TShirt, Gift, Storefront, FilmSlate, MusicNotes, GameController,
  Bank, CreditCard, Receipt, Coins, PiggyBank, HandCoins, Shield, Umbrella,
  Tag,
}

export function IconoCategoria({ nombre, size = 22, className }: { nombre?: string | null; size?: number; className?: string }) {
  const I = (nombre && ICONOS_CATEGORIA[nombre]) || Tag
  return <I size={size} className={className} />
}
