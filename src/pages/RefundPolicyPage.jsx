import React from 'react';
import Navbar from '../components/Navbar';
import ProfessionalFooter from '../components/ProfessionalFooter';
import { useTheme } from '../context/ThemeContext';

const RefundPolicyPage = () => {
  const { darkMode } = useTheme();
  const lastUpdated = "August 15, 2026";

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <Navbar />

      <div className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h1 className={`text-4xl sm:text-5xl font-black mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Refund Policy
            </h1>
            <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Last Updated: {lastUpdated}
            </p>
          </div>

          <div className={`prose prose-lg max-w-none ${darkMode ? 'prose-invert' : ''}`}>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                1. Overview
              </h2>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                At Calliotel, we want you to be fully satisfied with our services. This Refund Policy outlines the
                conditions under which refunds are granted. By using our services, you agree to this policy.
              </p>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                2. Wallet Credits
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>2.1 Unused Credits:</strong> Wallet credits that have not been used may be refunded within
                30 days of purchase. To request a refund, contact our support team at{' '}
                <a href="mailto:support@calliotel.com" className="text-emerald-500 hover:underline">support@calliotel.com</a>{' '}
                with your transaction details.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>2.2 Bonus Credits:</strong> Bonus credits awarded during top-up promotions are non-refundable
                and hold no cash value.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>2.3 Used Credits:</strong> Credits already spent on calls, SMS messages, SMM services, or
                any other completed transactions are non-refundable.
              </p>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                3. Virtual Phone Numbers
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>3.1 No refund after purchase:</strong> Virtual numbers are not refundable after you buy
                them, including after a single inbound SMS or call. This is a phone line for the paid period,
                not a one-time code trial.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>3.2 Cancel anytime:</strong> You may cancel from your dashboard. The number stays active
                until the paid period ends. No refund for unused days.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>3.3 Number Release:</strong> Upon cancellation, your number may be reassigned to another
                customer. Calliotel does not guarantee the ability to reclaim a previously cancelled number.
              </p>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                4. SMM Panel Services
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>4.1 Completed Orders:</strong> SMM orders that have been fully delivered are non-refundable.
              </p>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>4.2 Cancelled Orders:</strong> If an SMM order is cancelled before delivery begins, the
                amount is automatically refunded to your wallet balance.
              </p>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>4.3 Partial Delivery:</strong> If an order is partially delivered and cannot be completed,
                the undelivered portion will be refunded to your wallet balance.
              </p>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                5. Non-Refundable Items
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                The following are non-refundable under any circumstances:
              </p>
              <ul className={`list-disc pl-6 mb-4 space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <li>Completed calls and SMS messages (including a single verification code)</li>
                <li>Fully delivered SMM orders</li>
                <li>Bonus credits from promotions</li>
                <li>Virtual number monthly or prepaid fees after purchase</li>
                <li>Accounts terminated due to violations of our Terms of Service</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                6. How to Request a Refund
              </h2>
              <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                To request a refund, please contact our support team:
              </p>
              <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Company:</strong> Calliotel LLC
                </p>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Address:</strong> 30 N Gould Ste 225, Sheridan, WY 82801, United States
                </p>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:support@calliotel.com" className="text-emerald-500 hover:underline">
                    support@calliotel.com
                  </a>
                </p>
                <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Help Center:</strong>{' '}
                  <a href="/help" className="text-emerald-500 hover:underline">calliotel.com/help</a>
                </p>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>Response Time:</strong> We respond to all refund requests within 2 business days.
                </p>
              </div>
              <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Please include your account email address, transaction ID, and reason for the refund request.
                Refunds are processed to the original payment method within 5–10 business days.
              </p>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                7. Chargebacks
              </h2>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                If you initiate a chargeback with your bank instead of contacting us first, your account may be
                suspended while the dispute is investigated. We encourage customers to contact us directly —
                we resolve legitimate issues quickly and fairly.
              </p>
            </section>

            <section className="mb-12">
              <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                8. Changes to This Policy
              </h2>
              <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                We reserve the right to modify this Refund Policy at any time. Changes will be posted on this page
                with an updated date. Continued use of our services after changes constitutes acceptance of the
                revised policy.
              </p>
            </section>

          </div>
        </div>
      </div>

      <ProfessionalFooter />
    </div>
  );
};

export default RefundPolicyPage;
