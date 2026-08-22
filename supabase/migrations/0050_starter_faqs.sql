-- Module 23: starter FAQ content.
--
-- Separate from 0049 because this is CONTENT, not schema — the owner is
-- expected to edit and delete these in Admin → Content, and keeping them
-- in their own migration makes that obvious.
--
-- Why seed at all when Module 31 owns seed data: the FAQ chatbot answers
-- only from admin-written FAQs, and the table was empty. Shipping the
-- chatbot against zero FAQs would mean it answered "I don't know" to
-- every question, making the feature undemonstrable and untestable end
-- to end. These are a starting point to edit, not a blank page.
--
-- WORDING CONSTRAINT: no answer states a price, a delivery timescale, or
-- an order status. Module 22's guardrails would redact such text anyway
-- (and suppress the whole answer on a customer-facing surface), so an
-- answer promising "ready in 8-12 weeks" would simply never be shown.
-- Every answer below defers those specifics to the team, which is also
-- what the Master Build Plan's "Final Admin Quote" rule requires.

insert into public.faqs (question, answer, category, sort_order, is_active) values
  (
    'How does ordering a custom lehenga work?',
    'You start by choosing a design — either one of our pieces or your own combination in the custom builder. You then share your measurements and any inspiration images. Our team reviews everything and sends you a quotation to approve before any work begins. Nothing is made and nothing is charged until you have accepted your quotation.',
    'Ordering', 0, true
  ),
  (
    'How much does a custom lehenga cost?',
    'Every piece is quoted individually, because the fabric, embroidery and amount of handwork all change the price. The builder shows an estimate as you make choices, and our team confirms the final price in your written quotation. Please start a design or book a consultation for an accurate figure.',
    'Ordering', 1, true
  ),
  (
    'How long will my order take?',
    'It depends on the design — heavily embroidered bridal pieces take considerably longer than lighter occasion wear. Our team will confirm a realistic schedule in your quotation, before you commit. If you are working to a wedding date, please tell us the date when you enquire so we can advise you properly.',
    'Ordering', 2, true
  ),
  (
    'Can I design my own lehenga?',
    'Yes — that is what most of our customers do. The custom builder lets you choose your fabric, colour, embroidery style, sleeves, neckline and dupatta, and you can upload inspiration images alongside your design. You can save your design and come back to it, or send it to us for a quotation whenever you are ready.',
    'Ordering', 3, true
  ),
  (
    'How do I give you my measurements?',
    'You can save a measurement profile in your account and we will use it for your order. Our measurement guide explains how to take each measurement at home, with a diagram for each one. If you would rather be measured in person, book a consultation and we will do it for you.',
    'Measurements & Fit', 4, true
  ),
  (
    'What if my measurements change?',
    'Please tell us as soon as you can. Measurements can usually be updated while your piece is still in production, though there is a point after which the pattern is already cut. Contact us with your order number and our team will tell you what is still possible.',
    'Measurements & Fit', 5, true
  ),
  (
    'Do you offer fittings?',
    'Yes. You can book a fitting through the consultations page, either in person at our studio or virtually if you are not able to travel to us.',
    'Measurements & Fit', 6, true
  ),
  (
    'Do you offer alterations?',
    'Yes. Because every piece is made to your own measurements, major alterations are rarely needed — but we would always rather adjust a piece than leave you with something that does not fit. Contact us with your order number and we will arrange it.',
    'Measurements & Fit', 7, true
  ),
  (
    'Do you ship internationally?',
    'Yes, we ship worldwide from our UK studio. Shipping is quoted with your order so you can see it before you approve anything, and you will receive tracking once your piece is on its way.',
    'Delivery', 8, true
  ),
  (
    'Can I return a custom piece?',
    'Custom pieces are cut and embroidered to your own measurements, so they cannot be resold and are not returnable in the way ready-to-wear is. This is why we quote, confirm and fit carefully before making anything. If something is wrong with your piece when it arrives, contact us immediately and we will put it right.',
    'Delivery', 9, true
  ),
  (
    'How should I care for my lehenga?',
    'Always use a specialist dry cleaner experienced with heavy hand embroidery — never a domestic machine wash. Store the piece flat or on a padded hanger in a breathable cotton cover, away from direct sunlight, and keep the embroidery away from perfume and hairspray.',
    'Care', 10, true
  ),
  (
    'How do I pay?',
    'Once you approve your quotation you pay a deposit to begin production, and the balance before your piece ships. You can pay securely online by card, and every payment appears in your account with a receipt.',
    'Payment', 11, true
  );
