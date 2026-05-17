import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  className?: string;
  priority?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "blue" | "white";
};

const SIZE_CLASSES = {
  sm: "brand-logo-sm",
  md: "brand-logo-md",
  lg: "brand-logo-lg",
} as const;

const IMAGE_SIZES = {
  sm: { width: 853, height: 247 },
  md: { width: 853, height: 247 },
  lg: { width: 853, height: 247 },
} as const;

const VARIANT_SOURCES = {
  blue: "/brand/logo-azul.png",
  white: "/brand/logo-blanco.png",
} as const;

export function BrandLogo({
  href = "/",
  className,
  priority = false,
  size = "sm",
  variant = "blue",
}: BrandLogoProps) {
  const dimensions = IMAGE_SIZES[size];

  return (
    <Link
      aria-label="Importaciones Super"
      className={cn("brand-logo", SIZE_CLASSES[size], className)}
      href={href}
    >
      <Image
        alt="Importaciones Super"
        className="brand-logo-image"
        height={dimensions.height}
        priority={priority}
        src={VARIANT_SOURCES[variant]}
        width={dimensions.width}
      />
    </Link>
  );
}
