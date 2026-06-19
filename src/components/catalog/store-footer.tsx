import { BookOpenText, Clock3, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

const WHATSAPP_URL = "https://wa.me/51955252609?text=Hola%20quiero%20hacer%20una%20consulta";

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/importacionessuperoficial/?locale=es_LA", short: "FB" },
  { label: "Instagram", href: "https://www.instagram.com/importsupersac/", short: "IG" },
  { label: "TikTok", href: "https://www.tiktok.com/@super_importaciones", short: "TT" },
];

type ContactRow =
  | { label: string; value: string; href: string; icon: LucideIcon }
  | { label: string; value: string; href?: undefined; icon?: LucideIcon };

const CONTACT_ROWS: ContactRow[] = [
  { label: "Dirección", value: "Avenida Abancay 752, Centro de Lima", icon: Clock3 },
  { label: "Email", value: "supereimportaciones@gmail.com", href: "mailto:supereimportaciones@gmail.com", icon: Mail },
  { label: "Lun-Sáb", value: "08:00 am - 08:00 pm", icon: Clock3 },
  { label: "Domingo", value: "09:00 am - 08:00 pm" },
];

export function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="store-footer-shell">
        <div className="store-footer-brand">
          <BrandLogo href="/" size="sm" />
        </div>

        <div className="store-footer-links">
          <h2>Contáctanos</h2>
          <div className="store-footer-contact-list">
            {CONTACT_ROWS.map((row) => {
              const Icon = row.icon;

              return row.href ? (
                <a className="store-footer-contact-row" href={row.href} key={row.label} rel="noreferrer">
                  <span className="store-footer-contact-icon">
                    {Icon ? <Icon size={15} /> : null}
                  </span>
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.value}</small>
                  </span>
                </a>
              ) : (
                <div className="store-footer-contact-row" key={row.label}>
                  <span className="store-footer-contact-icon store-footer-contact-icon-muted">
                    {Icon ? <Icon size={15} /> : <Clock3 size={15} />}
                  </span>
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.value}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <section className="store-footer-complaints">
          <div className="store-footer-complaints-copy">
            <span className="store-footer-complaints-eyebrow">Síguenos en:</span>
            <div className="store-footer-socials">
              {SOCIAL_LINKS.map((social) => (
                <a
                  className="store-footer-social"
                  href={social.href}
                  key={social.label}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{social.short}</span>
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <div className="store-footer-complaints-actions">
            <a className="store-footer-whatsapp" href={WHATSAPP_URL} rel="noreferrer" target="_blank">
              <span className="store-footer-whatsapp-icon">
                <WhatsAppIcon size={20} />
              </span>
              Comprar por WhatsApp
            </a>

            <a
              className="store-footer-complaints-row"
              href="/libro-reclamaciones"
            >
              <span className="store-footer-complaints-icon">
                <BookOpenText size={16} />
              </span>
              <span className="store-footer-complaints-row-copy">
                <strong>Libro de reclamaciones</strong>
                <small>Accede al formulario virtual</small>
              </span>
            </a>
          </div>
        </section>
      </div>
    </footer>
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M20.2 3.8A10.7 10.7 0 0 0 12.6 1h-.2C6.8 1 2.2 5.5 2.2 11.1c0 1.9.5 3.8 1.5 5.4L2 23l6.6-1.7c1.6.9 3.3 1.4 5.2 1.4h.1c5.6 0 10.1-4.5 10.1-10.1 0-2.7-1.1-5.2-3.1-7.1ZM14 19.3h-.1c-1.6 0-3.2-.4-4.6-1.3l-.3-.2-3.9 1 1-3.8-.2-.3a8 8 0 0 1-1.3-4.4c0-4.4 3.6-8 8.1-8h.1a8 8 0 0 1 5.7 2.3 8 8 0 0 1 2.4 5.7c0 4.4-3.6 8-8 8ZM18.4 14.2c-.3-.2-1.7-.9-2-.9-.3-.1-.5-.2-.7.2s-.8.9-1 .1-.5-.9-.9-1.2c-.4-.3-.7-.3-.5-.6.1-.2.6-.7.7-1 .2-.2.1-.5 0-.7-.1-.2-.7-1.6-1-2.2-.2-.6-.5-.5-.7-.5H11c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.4s1.2 2.7 1.4 2.9c.2.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.1.1-1.2-.1-.2-.3-.2-.6-.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
