import {
  Briefcase, Book, Car, Code, Coffee, Dumbbell, GraduationCap, Heart, Home, List, Music, Plane, ShoppingCart,
  Star, Stethoscope, User, Users, Wallet, Gift, Leaf, Palette, Utensils, Baby, PawPrint, type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  list: List, user: User, briefcase: Briefcase, "shopping-cart": ShoppingCart, home: Home, heart: Heart,
  book: Book, "graduation-cap": GraduationCap, dumbbell: Dumbbell, plane: Plane, star: Star, code: Code,
  music: Music, wallet: Wallet, users: Users, coffee: Coffee, stethoscope: Stethoscope, car: Car, gift: Gift,
  leaf: Leaf, palette: Palette, utensils: Utensils, baby: Baby, paw: PawPrint,
};

export const CATEGORY_COLORS = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE", "#30B0C7",
  "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E", "#8E8E93",
];

export function CategoryIcon({ icon, color, size = 30, className = "" }: { icon: string; color: string; size?: number; className?: string }) {
  const I = CATEGORY_ICONS[icon] ?? List;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 78%, black))`, boxShadow: `inset 0 1px 0 rgb(255 255 255 / .35), 0 4px 10px -3px ${color}88` }}
    >
      <I size={size * 0.52} strokeWidth={2.4} />
    </span>
  );
}
