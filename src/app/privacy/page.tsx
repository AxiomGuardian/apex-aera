import type { Metadata } from "next";
import { MarketingNav, MarketingFooter, PageHeader } from "@/components/marketing/Shell";

export const metadata: Metadata = {
  title: "Privacy Policy | APEX AERA",
  description: "How APEX AERA collects, uses, and protects your data, and how to request deletion.",
};

const CONTACT_EMAIL = "guardian.v.artemis@gmail.com";
const EFFECTIVE = "September 2, 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Who we are",
    body: [
      "APEX AERA (\"APEX\", \"we\", \"us\") operates the website apexaera.com and the APEX AERA platform, an AI marketing service that analyzes, writes, schedules, and publishes content on behalf of the brands we work with. This policy explains what information we collect, why, and the choices you have.",
    ],
  },
  {
    title: "Information we collect",
    body: [
      "Account information. When you are invited to the platform we collect your name, email address, and a password you choose. We also record which brand workspace you belong to and your role within it.",
      "Content you upload. Videos, images, descriptions, and notes you add to your workspace. To understand your content we extract still frames from videos and generate transcripts of any speech.",
      "Brand profile. Tone of voice, target audience, website, and similar details you provide so our AI can write in your voice.",
      "Social platform data. When you connect a social account (for example a Facebook Page or Instagram Business account), the platform provides us with access tokens, your page or account identifier, and your account or page name. We use these only to publish the content you have scheduled and to read basic performance data about those posts.",
      "Usage data. Standard technical information such as browser type, pages visited, and timestamps, used to keep the service secure and working.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To run the service: analyzing your content, researching your market, writing captions, building your posting calendar, publishing to the platforms you connect, and producing reports.",
      "To communicate with you: invitations, sign-in links, weekly digests, and notices about your account or your scheduled posts.",
      "To keep the platform secure and reliable, and to improve how our engines perform.",
      "We do not sell your personal information, and we do not use your uploaded content to train AI models that are shared with anyone outside your workspace.",
    ],
  },
  {
    title: "Service providers",
    body: [
      "We rely on a small number of providers to operate the platform. Each one only receives what it needs to do its job: Supabase (database, authentication, and file storage), Vercel (hosting), xAI (AI text generation and market research), and Deepgram (speech to text for transcripts). When you connect a social account, the relevant platform (such as Meta) processes the content we publish under its own terms and privacy policy.",
    ],
  },
  {
    title: "Data retention",
    body: [
      "We keep your account and workspace data for as long as your workspace is active. Signed links to your media are short lived and expire automatically. Social platform access tokens are stored encrypted at rest and are removed when you disconnect the platform or when your workspace is closed.",
    ],
  },
  {
    title: "Your choices and data deletion",
    body: [
      "You can disconnect any social platform from your workspace at any time, which removes the stored access token. You can delete any uploaded content from the Content page.",
      "To delete your account, your workspace, or any data we hold about you, email " + CONTACT_EMAIL + " from the address on your account with the subject line \"Data deletion request\". We will confirm receipt and complete the deletion within 30 days, then send you a confirmation. If you connected a Facebook or Instagram account, you can also remove APEX AERA from your Meta account settings under Business Integrations, and we will delete the associated data on our side when we receive the removal notice.",
    ],
  },
  {
    title: "Security",
    body: [
      "Access to every workspace is restricted by row level security in our database, which means clients only ever see their own data. All traffic is encrypted in transit. Only the people you or our team have invited can access your workspace.",
    ],
  },
  {
    title: "Children",
    body: [
      "The platform is a business tool and is not intended for anyone under 18. We do not knowingly collect information from children.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "We may update this policy as the platform grows. When we do, we will change the effective date above and, for meaningful changes, let you know inside the platform. Questions about this policy can be sent to " + CONTACT_EMAIL + ".",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      <MarketingNav />
      <PageHeader kicker="Legal" title="Privacy Policy" sub={"Effective " + EFFECTIVE} />
      <section className="mx-auto max-w-3xl px-5 sm:px-6 pb-20 pt-2">
        <div className="mkt-card mkt-quiet p-6 sm:p-10 flex flex-col gap-8">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="font-semibold text-base mb-3" style={{ color: "var(--text-2, #d8d8d8)" }}>
                {s.title}
              </h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-4, #9a9a9a)" }}>
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
