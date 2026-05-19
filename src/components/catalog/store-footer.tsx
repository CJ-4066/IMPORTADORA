import { BookOpenText, Clock3, Mail, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

const WHATSAPP_URL = "https://wa.me/51955252609?text=Hola%20quiero%20hacer%20una%20consulta";

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/importacionesSUPERSAC", short: "FB" },
  { label: "Instagram", href: "https://www.instagram.com/importsupersac/", short: "IG" },
  { label: "YouTube", href: "https://www.youtube.com/@importacionessupersac4571/videos", short: "YT" },
];

type ContactRow =
  | { label: string; value: string; href: string; icon: LucideIcon }
  | { label: string; value: string; href?: undefined; icon?: LucideIcon };

const CONTACT_ROWS: ContactRow[] = [
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

          <a className="store-footer-whatsapp" href={WHATSAPP_URL} rel="noreferrer" target="_blank">
            <MessageCircle size={16} />
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
        </section>
      </div>
    </footer>
  );
}
