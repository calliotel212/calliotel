import React from 'react';
import Navbar from '../components/Navbar';
import ProfessionalFooter from '../components/ProfessionalFooter';
import { useTheme } from '../context/ThemeContext';

const TermsOfServicePage = () => {
  const { darkMode } = useTheme();
  const lastUpdated = "April 18, 2026";

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <Navbar />
      
      <div className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className={`text-4xl sm:text-5xl font-black mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Terms of Service
            </h1>
            <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Content */}
          <div className={`prose prose-lg max-w-none ${darkMode ? 'prose-invert' : ''}`}>
            
            {/* Agreement */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                1. Agreement to Terms
              </h2>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                By accessing or using Calliotel's Services, you agree to be bound by these Terms of Service 
                and all applicable laws and regulations. If you do not agree with any of these terms, you are 
                prohibited from using our Services.
              </p>
            </section>

            {/* Service Description */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                2. Service Description
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Calliotel provides virtual phone number services, including but not limited to:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Virtual phone numbers from multiple countries</li>
                <li>SMS/MMS messaging capabilities</li>
                <li>Voice calling and call forwarding services</li>
                <li>Mobile and web applications</li>
                <li>Additional features as described on our website</li>
              </ul>
            </section>

            {/* Account Registration */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                3. Account Registration
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                To use our Services, you must:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Be at least 18 years of age</li>
                <li>Provide accurate, complete, and current information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            {/* Acceptable Use */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                4. Acceptable Use Policy
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                You agree NOT to use our Services for:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li><strong>Illegal Activities:</strong> Any unlawful purpose or activity</li>
                <li><strong>Spam:</strong> Unsolicited bulk messaging or robocalls</li>
                <li><strong>Fraud:</strong> Identity theft, phishing, or financial scams</li>
                <li><strong>Harassment:</strong> Threatening, abusive, or harassing communications</li>
                <li><strong>Adult Content:</strong> Distribution of explicit or adult content</li>
                <li><strong>Network Abuse:</strong> Denial-of-service attacks or unauthorized access</li>
                <li><strong>Impersonation:</strong> Misrepresenting your identity or affiliation</li>
                <li><strong>Violation of Rights:</strong> Infringing on intellectual property or privacy rights</li>
              </ul>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Violation of this policy may result in immediate termination of your account without refund.
              </p>
            </section>

            {/* User Responsibility — OTP / SMS / Number Use */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                4A. Your Sole Responsibility for How You Use the Service
              </h2>
              <div className={`p-5 rounded-xl mb-4 ${darkMode ? 'bg-red-950/30 border border-red-500/40' : 'bg-red-50 border border-red-200'}`}>
                <p className={`font-bold mb-2 ${darkMode ? 'text-red-300' : 'text-red-800'}`}>
                  ⚠️ IMPORTANT — READ CAREFULLY
                </p>
                <p className={`${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Calliotel is a neutral telecommunications provider. We supply virtual phone numbers,
                  SMS reception (including OTP / verification codes), and voice services in the same way
                  a SIM card or mobile carrier supplies a phone line. <strong>How you use those numbers
                  is entirely your responsibility.</strong>
                </p>
              </div>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                By using our Services you expressly acknowledge and agree that:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>
                  <strong>You — and you alone — are legally responsible</strong> for every account you
                  register, every OTP / verification code you receive, every SMS you send, every call
                  you make, and every action taken using a number obtained from Calliotel.
                </li>
                <li>
                  You will only use Calliotel numbers to register for, sign in to, or interact with
                  third-party platforms <strong>where doing so does not violate that platform's terms
                  of service, applicable laws, or the rights of any third party</strong>.
                </li>
                <li>
                  You will <strong>not</strong> use our numbers to commit fraud, identity theft, account
                  takeover, scams, phishing, money laundering, ban evasion, multi-account / fake-account
                  creation in violation of a platform's rules, or any activity that is illegal in your
                  jurisdiction or the jurisdiction of the recipient.
                </li>
                <li>
                  You will <strong>not</strong> use our numbers to harass, threaten, defame, dox, stalk,
                  exploit, or harm any person, or to distribute malware, CSAM, terrorism content, or any
                  other unlawful material.
                </li>
                <li>
                  You will <strong>not</strong> resell, rent, lease, or share access to a Calliotel number
                  with any third party without our prior written authorization.
                </li>
                <li>
                  Calliotel does <strong>not monitor, review, endorse, or have any control over</strong>
                  the third-party services you choose to register on, the content of OTPs / SMS messages
                  you receive, or the use you make of them, and we accept no responsibility for those activities.
                </li>
                <li>
                  You confirm you are <strong>solely responsible for compliance</strong> with all
                  applicable telecommunications, anti-spam (TCPA, CAN-SPAM, GDPR ePrivacy, etc.),
                  consumer protection, sanctions, export-control, and data-protection laws in every
                  jurisdiction in which you operate.
                </li>
              </ul>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Any breach of this section is a material breach of these Terms and authorizes us to
                immediately suspend or terminate your account, release the affected number(s), withhold
                refunds, preserve and disclose records to law enforcement, and pursue any other remedy
                available to us at law or in equity.
              </p>
            </section>

            {/* Payment Terms */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                5. Payment and Billing
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>5.1 Pricing:</strong> Virtual numbers are billed monthly at the rates displayed on our website. 
                Prices are subject to change with 30 days' notice.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>5.2 Automatic Renewal:</strong> Your subscription automatically renews each month unless 
                canceled. You authorize us to charge your payment method on file.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>5.3 Payment Methods:</strong> We accept major credit cards, PayPal, and cryptocurrency. 
                All payments are processed securely via Stripe.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>5.4 Failed Payments:</strong> If payment fails, we will attempt to charge your card up to 
                3 times. After 3 failed attempts, your numbers may be suspended or released.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>5.5 Taxes:</strong> Prices exclude applicable taxes, which will be added at checkout based 
                on your billing address.
              </p>
            </section>

            {/* Cancellation */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                6. Cancellation and Refunds
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>6.1 Cancellation:</strong> You may cancel any virtual number at any time from your dashboard. 
                Cancellation takes effect at the end of your current billing period.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>6.2 Refunds:</strong> Virtual numbers are not refundable after purchase, including after
                a single inbound SMS or call. No refunds for partial months. You may cancel anytime; the number
                stays active until the paid period ends.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>6.3 Number Release:</strong> Upon cancellation, your number may be reassigned to another 
                customer. We do not guarantee the ability to reclaim a previously canceled number.
              </p>
            </section>

            {/* Service Availability */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                7. Service Availability
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We strive for 99.9% uptime but do not guarantee uninterrupted service. We are not liable for:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Scheduled maintenance or upgrades</li>
                <li>Third-party carrier outages</li>
                <li>Force majeure events (natural disasters, war, etc.)</li>
                <li>Internet connectivity issues beyond our control</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                8. Intellectual Property
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                All content, features, and functionality of our Services (including but not limited to software, 
                text, graphics, logos, and trademarks) are owned by Calliotel and protected by copyright, 
                trademark, and other intellectual property laws.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                You may not reproduce, distribute, modify, or create derivative works without our express written permission.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                9. Limitation of Liability
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CALLIOTEL SHALL NOT BE LIABLE FOR:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Indirect, incidental, or consequential damages</li>
                <li>Loss of profits, data, or business opportunities</li>
                <li>Damages resulting from unauthorized access to your account</li>
                <li>Content or conduct of third parties</li>
              </ul>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Our total liability for any claim shall not exceed the amount you paid us in the past 12 months.
              </p>
            </section>

            {/* Indemnification */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                10. Indemnification &amp; Hold Harmless
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                You agree to <strong>defend, indemnify, and hold completely harmless</strong> Calliotel
                LLC, its parent, subsidiaries, officers, directors, employees, agents, suppliers, upstream
                carriers, and licensors from and against any and all claims, demands, investigations,
                actions, proceedings, losses, fines, penalties, damages, liabilities, settlements, costs,
                and expenses (including reasonable attorneys' fees) of any kind whatsoever, arising out
                of or relating to:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Your use or misuse of any Calliotel virtual number, OTP, SMS, or voice service;</li>
                <li>Any account you create, sign in to, or operate on a third-party platform using a Calliotel number;</li>
                <li>Any fraudulent, deceptive, abusive, harassing, or illegal activity conducted through your account;</li>
                <li>Any violation by you of these Terms, the Acceptable Use Policy, Section 4A above, or any applicable law or regulation;</li>
                <li>Any infringement or misappropriation by you of any third party's intellectual property, privacy, publicity, or other rights;</li>
                <li>Any content you transmit, receive, or store via the Services;</li>
                <li>Any chargeback, reversal, or dispute initiated by you in bad faith.</li>
              </ul>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                This obligation will survive termination of these Terms and your use of the Services.
                Calliotel reserves the right, at your expense, to assume the exclusive defense and
                control of any matter for which you are required to indemnify us, and you agree to
                cooperate with our defense of such claims.
              </p>
            </section>

            {/* Termination */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                11. Termination
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We reserve the right to suspend or terminate your account immediately, without notice, for:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment</li>
                <li>Abuse of our Services or support team</li>
              </ul>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Upon termination, your right to use the Services ceases immediately. You remain liable for 
                all outstanding charges.
              </p>
            </section>

            {/* Governing Law */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                12. Governing Law
              </h2>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                These Terms are governed by the laws of the State of Wyoming, United States, without regard 
                to conflict of law principles. Any disputes shall be resolved in the courts of Sheridan County, Wyoming.
              </p>
            </section>

            {/* Dispute Resolution */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                13. Dispute Resolution
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>13.1 Informal Resolution:</strong> Before filing a claim, you agree to contact us at 
                <a href="mailto:support@calliotel.com" className="text-emerald-500 hover:underline"> support@calliotel.com</a> to 
                attempt to resolve the dispute informally.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>13.2 Arbitration:</strong> If informal resolution fails, disputes shall be resolved through 
                binding arbitration in accordance with the American Arbitration Association rules.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>13.3 Class Action Waiver:</strong> You agree to resolve disputes on an individual basis 
                and waive the right to participate in class actions.
              </p>
            </section>

            {/* Changes to Terms */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                14. Changes to Terms
              </h2>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We reserve the right to modify these Terms at any time. Material changes will be communicated 
                via email or prominent notice on our website. Continued use of our Services after changes 
                constitutes acceptance of the new Terms.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                15. Contact Information
              </h2>
              <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Company:</strong> Calliotel LLC
                </p>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Address:</strong> 30 N Gould Ste 225, Sheridan, WY 82801, United States
                </p>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Email:</strong> <a href="mailto:support@calliotel.com" className="text-emerald-500 hover:underline">support@calliotel.com</a>
                </p>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Support:</strong> <a href="/help" className="text-emerald-500 hover:underline">Help Center</a>
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>

      <ProfessionalFooter />
    </div>
  );
};

export default TermsOfServicePage;
