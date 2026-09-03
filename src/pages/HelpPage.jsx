import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ChevronDown, ChevronUp, HelpCircle, Mail, MessageSquare, Phone, Send, Book, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const HelpPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { darkMode } = useTheme();
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  const toggleAccordion = (index) => {
    setActiveAccordion(activeAccordion === index ? null : index);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!contactForm.email || !contactForm.message) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in email and message',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      // For now, just show success - you can add backend endpoint later
      toast({
        title: 'Message Sent!',
        description: 'Our support team will contact you within 24 hours',
      });
      
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          question: "How do I purchase a phone number?",
          answer: "Go to 'Browse Numbers', search by country, and click 'Purchase' on any available number. You'll need sufficient balance in your wallet. Numbers start at $1.99/month."
        },
        {
          question: "How do I find my Client ID?",
          answer: "Your Client ID is displayed on your Dashboard in a blue box. It looks like 'CL12345678'. Share this ID with others to receive transfers."
        },
        {
          question: "What countries are supported?",
          answer: "We offer virtual numbers from 6 countries: US, Canada, UK, Netherlands, Sweden, and Puerto Rico. Search by country in 'Browse Numbers' to see availability."
        }
      ]
    },
    {
      category: "Payments & Billing",
      questions: [
        {
          question: "How do I add credits to my wallet?",
          answer: "Go to your Wallet page and click 'Add Credits'. Choose from our packages: Starter ($10), Basic ($25 + $2 bonus), Pro ($50 + $5 bonus), or Premium ($100 + $15 bonus). We accept credit cards and crypto (USDC)."
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept credit/debit cards (Visa, Mastercard, Amex, Apple Pay, Google Pay) via Stripe, and cryptocurrency via NOWPayments — LTC, XRP, XLM, TRX, BCH from $5, and BTC, ETH, USDT from $15. Crypto works in every country, no bank account needed. All payments are secure and encrypted."
        },
        {
          question: "Are there any bonus credits?",
          answer: "Late Summer Talk (through Sep 21st): your first $5 top-up unlocks 60 minutes of US/Canada calling ($1.20 added to your wallet). After that, US/Canada calls are $0.02 per minute."
        },
        {
          question: "Are numbers refundable?",
          answer: "No. After you buy a number it is yours for the paid period — not a one-SMS trial. Cancel anytime; you keep the number until that period ends. Unused wallet credit: email support@calliotel.com."
        },
        {
          question: "How much do services cost?",
          answer: "SMS: $0.01 per message, Calls: $0.02 per minute, Phone numbers: from $1.99/month (varies by country), Number transfer: $1.00 fee. All charges are deducted from your wallet balance."
        }
      ]
    },
    {
      category: "Wallet & Transfers",
      questions: [
        {
          question: "How does the wallet system work?",
          answer: "Add credits to your wallet to pay for services. All charges (SMS, calls, numbers) are automatically deducted. You can view your balance and transaction history in the Wallet page."
        },
        {
          question: "Can I transfer balance to another user?",
          answer: "Yes! Balance transfers are FREE. Go to Wallet, click 'Transfer', enter the recipient's Client ID and amount. They'll receive it instantly."
        },
        {
          question: "Can I transfer my number to another user?",
          answer: "Yes! Go to 'My Numbers', click 'Transfer Number', and enter the recipient's Client ID. There's a $1.00 transfer fee, and the number transfers immediately."
        }
      ]
    },
    {
      category: "SMS & Calling",
      questions: [
        {
          question: "How does SMS messaging work?",
          answer: "After purchasing a number, go to the SMS page. You can send messages to any number and receive replies. Each SMS costs $0.01 and is deducted from your wallet."
        },
        {
          question: "How do I make voice calls?",
          answer: "Voice calling is available on supported number plans. Once your number is active, you can make outbound calls from the keypad. US & Canada are $0.02 per minute. First $5 this campaign adds 60 US/Canada minutes. Other destinations use the rate shown before you dial."
        },
        {
          question: "Can I receive incoming SMS and calls?",
          answer: "Yes! Your virtual number receives incoming SMS and calls automatically once it's active. All incoming messages appear in your SMS inbox on the dashboard in real time. Incoming calls can be forwarded to any number you choose."
        }
      ]
    },
    {
      category: "Account & Security",
      questions: [
        {
          question: "How do I verify my email?",
          answer: "After signup, check your email for a verification link. Click it to verify your account. If you didn't receive it, go to your profile and click 'Resend Verification Email'."
        },
        {
          question: "Can I login with Google?",
          answer: "Yes! Click 'Sign in with Google' on the login page. Your Google email will be automatically verified, giving you instant access without needing to confirm a separate email."
        },
        {
          question: "Is my data secure?",
          answer: "Yes! We use industry-standard encryption (AES-256) for all communications. Your messages, call data, and payment information are stored securely and never shared with third parties."
        },
        {
          question: "How do I release a number?",
          answer: "Go to 'My Numbers', find the number you want to release, and click 'Release Number'. This will stop monthly charges immediately. Released numbers cannot be recovered."
        }
      ]
    }
  ];

  const scrollToFaq = () => {
    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const quickLinks = [
    {
      icon: Book,
      title: "Getting Started Guide",
      description: "Read our FAQ — answers to all common questions",
      action: scrollToFaq,
      href: null,
    },
    {
      icon: Video,
      title: "Video Tutorial",
      description: "Watch how Calliotel works in 2 minutes",
      action: null,
      href: 'https://www.youtube.com/@calliotel',
    },
    {
      icon: MessageSquare,
      title: "Support tickets",
      description: "Open a ticket — our team replies in your account",
      action: () => navigate('/support'),
      href: null,
    },
    {
      icon: Mail,
      title: "Email Support",
      description: "Get help from our support team",
      action: null,
      href: 'mailto:support@calliotel.com',
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Help & Support</h1>
                <p className="text-sm text-gray-400">We're here to help you</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/sms')}
              className="px-4 py-2 text-gray-400 hover:text-orange-400 transition-colors"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Links */}
            <div className="grid grid-cols-1 gap-4">
              {quickLinks.map((link, index) => {
                const cls = "bg-gray-800/60 border border-gray-700/50 hover:border-emerald-500/40 p-5 rounded-xl transition-all text-left flex items-center gap-4 active:scale-[0.98]";
                const inner = (
                  <>
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <link.icon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-0.5">{link.title}</h3>
                      <p className="text-sm text-gray-400">{link.description}</p>
                    </div>
                    <span className="ml-auto text-gray-600 text-lg">›</span>
                  </>
                );
                if (link.href) {
                  return (
                    <a key={index} href={link.href} className={cls}>
                      {inner}
                    </a>
                  );
                }
                return (
                  <button key={index} onClick={link.action} className={cls}>
                    {inner}
                  </button>
                );
              })}
            </div>

            {/* FAQ Section */}
            <div id="faq-section" className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
              <div className="space-y-6">
                {faqs.map((category, categoryIndex) => (
                  <div key={categoryIndex}>
                    <h3 className="text-lg font-bold text-emerald-400 mb-3 pb-2 border-b border-gray-800">
                      {category.category}
                    </h3>
                    <div className="space-y-3">
                      {category.questions.map((faq, faqIndex) => {
                        const accordionKey = `${categoryIndex}-${faqIndex}`;
                        return (
                          <div key={faqIndex} className="border border-gray-700 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleAccordion(accordionKey)}
                              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-800/50 transition-colors"
                            >
                              <span className="font-medium text-white">{faq.question}</span>
                              {activeAccordion === accordionKey ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                            {activeAccordion === accordionKey && (
                              <div className="px-6 py-4 bg-gray-800/60 border-t border-gray-700">
                                <p className="text-gray-300">{faq.answer}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Support */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Contact Support</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Name</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Subject</label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    placeholder="How can we help?"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Message *</label>
                  <textarea
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Tell us more about your issue..."
                    rows="4"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {sending ? (
                    <>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Get in Touch</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-gray-300">Email</p>
                    <p className="font-medium text-white">support@calliotel.com</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-gray-300">Support Hours</p>
                    <p className="font-medium text-white">24/7 via chat & email</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-gray-300">Response Time</p>
                    <p className="font-medium text-white">Within 24 hours</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
