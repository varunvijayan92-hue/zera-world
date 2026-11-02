import { publicPageMetadata } from "@/lib/seo";
import { StoreInformationPage } from "@/components/store-information-page";
import { ContactForm } from "@/components/contact-form";
import { publicSupportDetails } from "@/lib/contact";
export const metadata = publicPageMetadata("Contact Us","Contact Zera's World for product, order, payment, shipping and return enquiries.","/contact");
export default function ContactPage() {
  const support = publicSupportDetails();
  return <StoreInformationPage title="Contact Us" introduction="We’re Here to Help">
    <section><p>Thank you for shopping with <strong>Zera&apos;s World</strong>.</p><p className="mt-4">Have a question about a product, order, payment, shipping, or return? Our customer support team is here to assist you.</p></section>
    <section><h2>Customer Support</h2><dl className="space-y-3"><div><dt className="inline font-semibold">Business Name: </dt><dd className="inline">Zera&apos;s World</dd></div>{support.email ? <div><dt className="inline font-semibold">Email: </dt><dd className="inline"><a href={`mailto:${support.email}`}>{support.email}</a></dd></div> : null}{support.phone ? <div><dt className="inline font-semibold">Phone / WhatsApp: </dt><dd className="inline">{support.phone}</dd></div> : null}{support.address ? <div><dt className="inline font-semibold">Business Address: </dt><dd className="inline whitespace-pre-line">{support.address}</dd></div> : null}{support.hours ? <div><dt className="inline font-semibold">Support Hours: </dt><dd className="inline">{support.hours}</dd></div> : null}</dl>{!support.email && !support.phone ? <p className="mt-4">Please use the contact form below to send your enquiry to our support team.</p> : null}</section>
    <section><h2>How Can We Help?</h2><p className="mb-3">You can contact us regarding:</p><ul><li>Product information and availability.</li><li>Order confirmation and status.</li><li>Shipping and delivery inquiries.</li><li>Payment-related concerns.</li><li>Return, replacement, and refund requests.</li><li>General feedback and suggestions.</li></ul></section>
    <section><h2>Send Us a Message</h2><p>For order-related inquiries, please include your order number so we can assist you more efficiently.</p>{support.responseTime ? <p className="mt-3">We aim to respond within <strong>{support.responseTime}</strong>.</p> : null}<ContactForm /></section><p className="font-semibold">Zera&apos;s World Customer Support</p>
  </StoreInformationPage>;
}
