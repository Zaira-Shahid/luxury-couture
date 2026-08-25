/**
 * The demo store's written content, kept apart from the seeding logic so
 * the copy can be edited without touching anything that talks to the
 * database.
 *
 * ALL OF THIS IS FICTION. The products do not exist, the customers are
 * invented, and the testimonials were written by an AI for a demo store.
 * Nothing here is derived from any real brand's photography, product
 * range or copy — the Master Build Plan's "do not use copyrighted brand
 * assets" rule is satisfied by there being nothing to infringe.
 */

/** Slugs map to the categories seeded by 0013. Resolved at seed time. */
/**
 * OCCASION TAGS AND 0062.
 *
 * Migration 0062 retired the `walima` and `party` occasions. These
 * entries still handed them out, so every `--seed` re-tagged products
 * with a dead occasion — and because a retired occasion is filtered out
 * of every storefront read, four products ended up published, listed,
 * and reachable under NO occasion chip at all. That is invisible unless
 * you happen to browse by occasion and count.
 *
 * The affected tags were moved to `reception`, which is the closest live
 * occasion for evening pieces (a charcoal kurta set, a champagne
 * two-piece, a slate cocktail lehenga, a plum saree). `test-seed-demo`
 * now fails if any published product is left without a live occasion,
 * so this cannot silently come back.
 */
export const DEMO_PRODUCTS = [
  {
    slug: "amrita-crimson-bridal-lehenga",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "red bridal lehenga", hex: "#8B0000" },
    name: "Amrita Crimson Bridal Lehenga",
    categorySlug: "asian-wear",
    occasions: ["bridal", "nikkah", "baraat"],
    price: 2850,
    featured: true,
    description:
      "A deep crimson bridal lehenga in dupion silk, hand-embroidered across the hem in gold zardozi. The blouse is fully lined and boned for structure, and the dupatta carries a matching scalloped border.\n\nMade to your measurements over approximately twelve weeks. Every piece is cut individually — no two are identical.",
  },
  {
    slug: "noor-ivory-gold-lehenga",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "ivory gold bridal lehenga", hex: "#EFE3C8" },
    name: "Noor Ivory & Gold Lehenga",
    categorySlug: "asian-wear",
    occasions: ["nikkah"],
    price: 3200,
    featured: true,
    description:
      "Ivory raw silk with antique gold thread work, cut with a full circular flare. The understated palette suits a daytime nikkah or a civil ceremony where a deeper red would feel heavy.\n\nThe embroidery is worked panel by panel before the skirt is assembled, which is what keeps the motif continuous across the seams.",
  },
  {
    slug: "sana-rose-mehndi-set",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "pink lehenga bride", hex: "#C48793" },
    name: "Sana Rose Mehndi Set",
    categorySlug: "asian-wear",
    occasions: ["mehndi"],
    price: 1450,
    description:
      "A lighter set for the mehndi, in dusty rose georgette with mirror work and tassel detailing. Cut for movement — the skirt is deliberately unstiffened so it sits softly when you are seated on the floor.",
  },
  {
    slug: "zara-emerald-reception-gown",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "green gown woman", hex: "#046307" },
    name: "Zara Emerald Reception Gown",
    // Asian Wear, not Western. The photograph is an emerald velvet
    // bridal with heavy gold work, a dupatta and mehndi'd hands — a
    // South Asian look filed under Western Wear purely because the word
    // "gown" is in its name.
    categorySlug: "asian-wear",
    occasions: ["reception"],
    price: 2400,
    description:
      "Emerald velvet with a fitted bodice and a sweeping train, finished with crystal and bead work at the shoulder. Designed for a reception where you will be photographed standing rather than seated.",
  },
  {
    slug: "meher-blush-anarkali",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "pink anarkali dress woman", hex: "#F2C4D2" },
    name: "Meher Blush Anarkali",
    categorySlug: "asian-wear",
    occasions: ["reception"],
    price: 890,
    featured: true,
    description:
      "A floor-length anarkali in blush chiffon over a silk lining, with fine chikankari at the yoke. Light enough for a summer wedding and simple enough to wear again.",
  },
  {
    slug: "aisha-midnight-sharara",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "blue lehenga woman", hex: "#1F2A44" },
    name: "Aisha Midnight Sharara",
    categorySlug: "asian-wear",
    occasions: ["reception"],
    price: 1150,
    description:
      "Midnight blue sharara in silk crepe, with a cropped embroidered kurti and a sheer organza dupatta. The trouser is cut wide from the knee, which is what gives the silhouette its drape.",
  },
  {
    slug: "layla-saffron-sharara",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "yellow lehenga woman", hex: "#E8A33D" },
    name: "Layla Saffron Sharara",
    categorySlug: "asian-wear",
    occasions: ["mehndi"],
    price: 980,
    description:
      "Saffron silk with gota patti trim along the hem and cuffs. A warm, celebratory colour that photographs well in low evening light.",
  },
  {
    slug: "hina-pistachio-gharara",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "green lehenga woman", hex: "#93C572" },
    name: "Hina Pistachio Gharara",
    categorySlug: "asian-wear",
    occasions: ["mehndi"],
    price: 1050,
    description:
      "Soft pistachio green gharara in tissue silk, gathered at the knee in the traditional cut. Paired with a short kurti and a contrast dupatta in deep rose.",
  },
  {
    slug: "raya-slate-cocktail-lehenga",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "grey dress woman traditional", hex: "#6E7681" },
    name: "Raya Slate Cocktail Lehenga",
    categorySlug: "asian-wear",
    occasions: ["reception"],
    price: 1320,
    description:
      "A modern cut in slate grey, with a fitted bustier and a panelled skirt. Minimal embroidery — the interest is in the seaming rather than the surface.",
  },
  {
    slug: "isla-champagne-two-piece",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "beige dress woman", hex: "#E6D3B3" },
    name: "Isla Champagne Two-Piece",
    // Seeded as a DRAFT: this is the one demo product with no usable
    // photograph. It is a champagne two-piece in stretch crepe, and every
    // champagne candidate sourced was a one-piece gown — so it would have
    // had to ship either with a gradient placeholder or with a picture of
    // a different garment. Publish it once a matching image exists.
    status: "draft",
    categorySlug: "western-wear",
    occasions: ["reception"],
    price: 620,
    description:
      "A ready-to-wear champagne set in stretch crepe, available in standard sizing and dispatched from stock. The one piece in the range that is not made to order.",
  },
  {
    slug: "nadia-charcoal-kurta-set",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "black kurta woman", hex: "#3A3F45" },
    name: "Nadia Charcoal Kurta Set",
    categorySlug: "asian-wear",
    occasions: ["reception"],
    price: 340,
    description:
      "A charcoal kurta and palazzo set in washed cotton silk, cut for everyday wear. Machine washable, unlike almost everything else we make.",
  },
  {
    slug: "priya-plum-evening-saree",
    // Photo sourcing: a query built from THIS product's colour and
    // garment, plus the colour the image should average near.
    photo: { query: "purple saree woman", hex: "#7E4569" },
    name: "Priya Plum Evening Saree",
    categorySlug: "asian-wear",
    occasions: ["reception", "party"],
    price: 780,
    description:
      "A pre-draped plum saree in satin georgette with a stitched pleat front, so it can be put on in a minute rather than twenty. Supplied with a matching fitted blouse.",
  },
];

export const DEMO_COLLECTIONS = [
  {
    slug: "bridal-couture",
    name: "Bridal Couture",
    featured: true,
    description:
      "Our made-to-measure bridal range, cut individually over ten to fourteen weeks. Every piece begins with a consultation and your own measurements.",
    productSlugs: [
      "amrita-crimson-bridal-lehenga",
      "noor-ivory-gold-lehenga",
      "sana-rose-mehndi-set",
      "zara-emerald-reception-gown",
    ],
  },
  {
    slug: "mehndi-and-mayoun",
    name: "Mehndi & Mayoun",
    featured: true,
    description:
      "Lighter, brighter pieces for the days before the wedding — cut for sitting, dancing and being photographed from every angle.",
    productSlugs: ["sana-rose-mehndi-set", "layla-saffron-sharara", "hina-pistachio-gharara"],
  },
  {
    slug: "reception-evening",
    name: "Reception & Evening",
    // All four collections are featured. Only two were, so the homepage
    // "Featured Collections" grid — three columns wide — rendered two
    // tiles and a gap. There are four collections and room for six.
    featured: true,
    description:
      "Structured silhouettes for the reception and for evening events, where the piece is seen standing and in motion.",
    productSlugs: [
      "zara-emerald-reception-gown",
      "raya-slate-cocktail-lehenga",
      "aisha-midnight-sharara",
    ],
  },
  {
    slug: "ready-to-wear",
    name: "Ready to Wear",
    featured: true,
    description:
      "A small stocked range in standard sizing, dispatched within a few days rather than made to order.",
    productSlugs: [
      "isla-champagne-two-piece",
      "nadia-charcoal-kurta-set",
      "priya-plum-evening-saree",
    ],
  },
];

/**
 * Testimonials.
 *
 * The ratings are deliberately NOT all fives. A wall of five stars reads
 * as fabricated to anyone who has shopped online, and a demo store that
 * looks fake teaches the owner nothing about how the real one will look.
 * The fours carry mild, specific criticism, which is what genuine
 * positive reviews actually contain.
 */
export const DEMO_REVIEWS = [
  {
    customer: "Priya S.",
    productSlug: "amrita-crimson-bridal-lehenga",
    rating: 5,
    title: "Exactly what I pictured",
    body: "I sent three reference photos and a very vague description and somehow they got it right. The gold work on the hem is heavier in person than in the photographs, which I loved. Fitted perfectly first time.",
  },
  {
    customer: "Ayesha K.",
    productSlug: "noor-ivory-gold-lehenga",
    rating: 5,
    title: "Worth the wait",
    body: "Twelve weeks felt like a long time when I ordered, but the fit is better than anything I have bought off the rack. The team sent progress photographs at each stage which helped enormously.",
  },
  {
    customer: "Fatima R.",
    productSlug: "meher-blush-anarkali",
    rating: 4,
    title: "Beautiful, slightly long",
    body: "The chikankari is lovely and the colour is exactly as shown. It arrived about an inch longer than I expected, so I had it taken up locally — not a complaint exactly, but worth knowing if you are petite.",
  },
  {
    customer: "Simran D.",
    productSlug: "zara-emerald-reception-gown",
    rating: 5,
    title: "Photographs beautifully",
    body: "The velvet catches the light in a way that looks wonderful in the reception photographs. Heavier than it looks, so factor that in if you plan to dance in it.",
  },
  {
    customer: "Nadia H.",
    productSlug: "aisha-midnight-sharara",
    rating: 4,
    title: "Lovely cut, dupatta is very sheer",
    body: "The sharara drapes exactly as described and the kurti fit straight away. The organza dupatta is more transparent than I expected — I wore it doubled over, which worked fine.",
  },
  {
    customer: "Zainab M.",
    productSlug: "sana-rose-mehndi-set",
    rating: 5,
    title: "Comfortable all day",
    body: "I was sitting on the floor for six hours and never once felt like I was fighting the outfit. The mirror work survived the whole evening intact.",
  },
  {
    customer: "Meera T.",
    productSlug: "isla-champagne-two-piece",
    rating: 4,
    title: "Good quality, quick delivery",
    body: "Arrived in three days. The crepe is a good weight and holds its shape. Sizing runs slightly small — I would size up if you are between two.",
  },
  {
    customer: "Ruqayya A.",
    productSlug: "priya-plum-evening-saree",
    rating: 5,
    title: "Finally, a saree I can put on myself",
    body: "The pre-draped pleating is neat enough that nobody could tell. I have worn it three times now and it still looks pressed.",
  },
];

export const DEMO_BLOG_POSTS = [
  {
    slug: "choosing-your-bridal-lehenga",
    title: "Choosing Your Bridal Lehenga: A Practical Guide",
    excerpt:
      "Colour, weight, timing and the questions worth asking before you commit to a made-to-measure piece.",
    content:
      "Most brides come to us with a folder of photographs and very little idea of what any of it costs or how long it takes. That is entirely normal, and this guide is meant to close the gap.\n\nStart with the weight, not the colour. A heavily worked lehenga can weigh six or seven kilograms, and you will be wearing it for eight hours or more. If your ceremony involves a great deal of standing, that weight matters more than the shade of red.\n\nOrder earlier than you think you need to. A made-to-measure piece takes ten to fourteen weeks, and that assumes measurements are confirmed promptly. Leaving four weeks is not enough, and rushing the fitting is where most disappointments begin.\n\nBring reference photographs, but bring the ones you dislike as well. Knowing what you do not want narrows a design conversation faster than a folder of things you admire.",
  },
  {
    slug: "understanding-zardozi",
    title: "Understanding Zardozi, Gota Patti and Chikankari",
    excerpt: "Three embroidery traditions, what distinguishes them, and how each wears over time.",
    content:
      "Embroidery terms get used loosely in shop descriptions, which makes it hard to compare pieces. Here is the short version.\n\nZardozi is metal thread work, traditionally gold or silver, couched onto the surface in raised motifs. It is the heaviest of the three and the most formal. It does not like being folded along the same line repeatedly, so store the piece rolled if you can.\n\nGota patti applies flat woven ribbon in geometric shapes. It is lighter, catches light differently, and suits daytime events. It is also considerably more forgiving of movement.\n\nChikankari is white-on-white shadow work from Lucknow, done with fine cotton thread on sheer fabric. It is the lightest and the most understated, and it rewards close viewing rather than distance.",
  },
  {
    slug: "how-measurements-work",
    title: "How Made-to-Measure Actually Works",
    excerpt:
      "What we measure, why we ask for it twice, and what happens if your size changes before the wedding.",
    content:
      "We take twelve measurements for a lehenga and fifteen for a fitted gown. You can submit them yourself through your account, or come in and have them taken.\n\nWe ask again about four weeks before delivery. This is not an administrative habit — bodies change in the run-up to a wedding, often quite a lot, and the second set is what the final fitting is cut to. The first set is what the pattern is drafted from.\n\nIf your measurements change substantially between the two, we will tell you what can and cannot be adjusted. A bodice can usually be let out or taken in by a size. A fully embroidered skirt panel generally cannot, because the motif will no longer meet at the seam.",
  },
  {
    slug: "caring-for-your-lehenga",
    title: "Caring For Your Lehenga After The Day",
    excerpt: "Storage, cleaning and the one thing that ruins more pieces than anything else.",
    content:
      "The single most common cause of damage is storing a piece in a plastic garment bag. Plastic traps moisture, and moisture and metal thread work do not coexist. Use cotton or muslin.\n\nDo not machine wash anything with surface embroidery, and be cautious with dry cleaners who have not handled zardozi before — ask directly. A cleaner who hesitates is being honest with you.\n\nStore rolled rather than folded where you have the space. If you must fold, refold along different lines every year or so, because a crease that sits in the same place indefinitely will eventually become permanent.",
  },
];

/**
 * CMS pages.
 *
 * /privacy is the important one. It has been a launch blocker since
 * Module 21: the cookie consent banner and the chat widget both link to
 * it, and until now the page did not exist.
 *
 * THE LEGAL TEXT IS A DRAFT, and says so on its face. It names the data
 * this application actually collects — which is more than a generic
 * template would — but a privacy policy is a legal document and this one
 * needs a solicitor before launch.
 */
export const DEMO_PAGES = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    content:
      "DRAFT — this policy has not been reviewed by a solicitor and must be before launch.\n\nIt describes the data this website actually collects, so it is a starting point rather than a generic template. Anything inaccurate here is a compliance problem, not a copy problem.\n\nWho we are\n\nThis website is operated by the business named in the footer. For UK GDPR purposes we are the data controller for the information described below. Our contact address for data questions is the email address on our contact page.\n\nWhat we collect and why\n\nAccount details. When you create an account we store your email address and, if you provide it, your name and telephone number. This is how we identify you and contact you about your order.\n\nOrder and measurement data. If you place an order we store your delivery address, your measurements, your order history and your payment records. Measurements are personal data and are stored against your account so you do not have to provide them again.\n\nEnquiries and appointments. If you contact us or book a consultation we store what you sent us and your contact details so we can reply.\n\nPayment information. Card details are handled by our payment processor and are never stored on our servers. We keep a record of the amount, the date and the processor's reference.\n\nAnalytics. If you consent to analytics cookies we record which pages you view, in order to understand how the site is used. You can decline this and the site works normally. Raw analytics records are deleted after fourteen months.\n\nRate limiting. To prevent abuse of our contact forms we store a one-way hash of your IP address for a short period. We cannot recover the address from the hash.\n\nEmail. We record whether transactional emails were sent and delivered. You can turn off marketing email at any time from your account or by using the unsubscribe link in any marketing message. Emails about an order you have placed are not marketing and are always sent.\n\nWho we share it with\n\nOur hosting, database, email and payment providers process data on our behalf under contract. We do not sell personal data.\n\nHow long we keep it\n\nOrder records are kept for as long as we are required to for tax and accounting purposes. Analytics data is deleted after fourteen months. You can ask us to delete your account at any time.\n\nYour rights\n\nUnder UK GDPR you have the right to access the personal data we hold about you, to have it corrected, to have it deleted, to restrict or object to how we use it, and to receive a copy in a portable format. Contact us using the details on our contact page. You also have the right to complain to the Information Commissioner's Office.\n\nCookies\n\nWe use a small number of cookies that are necessary for the site to work, including one that remembers your basket and one that records your cookie choices. Analytics cookies are only set if you consent.",
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    content:
      "DRAFT — these terms have not been reviewed by a solicitor and must be before launch.\n\nOrders\n\nA made-to-measure order is confirmed when we accept your quotation and receive your deposit. Because each piece is cut individually to your measurements, a confirmed made-to-measure order cannot be cancelled once cutting has begun.\n\nDeposits and balances\n\nWe take a deposit at the point of order and the balance before dispatch. The deposit percentage is shown on your quotation.\n\nTimescales\n\nProduction timescales given on this website are estimates based on typical work, not guarantees. We will tell you promptly if your order is running late.\n\nReturns\n\nReady-to-wear items in unworn condition may be returned within fourteen days. Made-to-measure pieces are exempt from distance-selling cancellation rights under the Consumer Contracts Regulations because they are made to your specification.\n\nFit\n\nWe cut to the measurements you provide or that we take. If a piece does not fit because the measurements changed, we will do what we can, but alterations to embroidered panels are sometimes not possible.",
  },
  {
    slug: "about",
    title: "About Us",
    content:
      "We are a small atelier making bridal and occasion wear to measure for customers across the United Kingdom.\n\nEvery piece is cut individually. There is no standard sizing on the made-to-measure range, and no two orders are worked identically — the pattern is drafted from your own measurements and the embroidery is placed to suit the finished shape rather than a generic block.\n\nMost pieces take between ten and fourteen weeks. That is not a queue; it is how long the work takes when it is done by hand.\n\nWe would rather talk to you before you order. Consultations are free and can be held in person or over video.",
  },
  {
    slug: "delivery-and-returns",
    title: "Delivery & Returns",
    content:
      "Delivery\n\nReady-to-wear orders are dispatched within two to three working days and sent on a tracked service. Made-to-measure orders are dispatched once the balance is settled, which we will invite you to do when the piece is finished.\n\nWe deliver across the United Kingdom. For international delivery, please contact us before ordering.\n\nReturns\n\nReady-to-wear items may be returned within fourteen days provided they are unworn, unaltered and in their original packaging. Contact us first so we can give you a returns reference.\n\nMade-to-measure pieces cannot be returned because they do not fit a standard size and cannot be resold. This is why we take measurements twice and why we recommend a fitting.\n\nFaults\n\nIf something is wrong with your order, tell us within a reasonable time and we will put it right. This does not affect your statutory rights.",
  },
];

export const DEMO_GALLERY_CAPTIONS = [
  "Hand-worked zardozi on the Amrita hem",
  "Ivory raw silk, ready for the first fitting",
  "Gota patti trim, applied by hand",
  "The Zara gown, before the train was attached",
  "Mirror work in progress on the Sana set",
  "Pistachio tissue silk, gathered at the knee",
];
