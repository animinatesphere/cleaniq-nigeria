// Content for the landing page. Edit copy and contact details here.

// TODO: replace with the real Lagos WhatsApp number, phone and email before launch.
export const CONTACT = {
  whatsapp: "2348000000000", // international format, no "+"
  phoneDisplay: "+234 800 000 0000",
  email: "hello@cleaniq.ng",
  city: "Lagos, Nigeria",
};

export const whatsappLink = (message = "Hi Cleaniq, I'd like to book a clean in Lagos.") =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`;

export const SERVICES = [
  {
    id: "regular",
    title: "Regular Cleaning",
    tagline: "Weekly, bi-weekly or monthly",
    description:
      "Routine upkeep that keeps your home fresh, tidy and guest-ready — without you lifting a finger.",
    image: "/images/regular-vacuum.jpg",
    icon: "House",
    includes: [
      "Dusting & wiping all surfaces",
      "Vacuuming & mopping floors",
      "Kitchen counters & sink",
      "Bathroom & toilet cleaning",
      "Bed making & tidying",
      "Emptying bins",
    ],
  },
  {
    id: "deep",
    title: "Deep Cleaning",
    tagline: "Top-to-bottom, every corner",
    description:
      "A thorough clean that reaches everything routine cleaning misses — ideal for move-ins, move-outs and seasonal resets.",
    image: "/images/deep-cabinet.jpg",
    icon: "SprayCan",
    includes: [
      "Inside cabinets & appliances",
      "Tile & grout scrubbing",
      "Behind & under furniture",
      "Doors, switches & skirting",
      "Window tracks & frames",
      "Bathroom descaling",
    ],
  },
  {
    id: "post-construction",
    title: "Post-Construction",
    tagline: "After building or renovation",
    description:
      "We clear the dust, paint splashes and debris your builders leave behind, so your space is ready to move into.",
    image: "/images/post-construction.jpg",
    icon: "HardHat",
    includes: [
      "Fine dust removal everywhere",
      "Paint & cement splash removal",
      "Windows, frames & glass",
      "Floor scrubbing & polishing",
      "Fixtures & fittings polished",
      "Light debris cleared",
    ],
  },
];

export const STEPS = [
  { icon: "MessageCircle", title: "Tell us what you need", text: "Message us on WhatsApp or call — share your location, the service and the size of your space." },
  { icon: "ClipboardList", title: "Get a clear quote", text: "We confirm the price and pick a date and time that works for you. No surprises." },
  { icon: "BrushCleaning", title: "We clean", text: "Our trained team arrives on time with professional equipment and gets to work." },
  { icon: "Smile", title: "You relax", text: "Walk into a spotless space. Not happy with something? Tell us and we'll make it right." },
];

export const GALLERY = [
  { src: "/images/kitchen.jpg", label: "Kitchens", span: "col-span-2 md:row-span-2" },
  { src: "/images/bathroom.jpg", label: "Bathrooms", span: "row-span-2" },
  { src: "/images/apartment-block.jpg", label: "Apartments & estates", span: "row-span-2" },
  { src: "/images/kitchen-island.jpg", label: "Open-plan spaces", span: "col-span-2" },
  { src: "/images/window-clean.jpg", label: "Windows & sills", span: "" },
  { src: "/images/office-team.jpg", label: "Offices", span: "" },
];

export const FEATURES = [
  { icon: "ShieldCheck", title: "Vetted & trained cleaners", text: "Every cleaner is screened and trained to our standard before their first job." },
  { icon: "SprayCan", title: "Professional equipment", text: "We bring the right tools and products for every surface in your home." },
  { icon: "CalendarCheck", title: "Flexible scheduling", text: "Weekdays or weekends — book a one-off clean or a regular slot." },
  { icon: "Wallet", title: "Clear upfront quotes", text: "You know the price before we start. No hidden charges." },
];

export const LAGOS_AREAS = [
  "Lekki", "Victoria Island", "Ikoyi", "Ajah", "Oniru", "Chevron", "Sangotedo",
  "Ikeja", "GRA", "Maryland", "Magodo", "Gbagada", "Yaba", "Surulere",
];

export const FAQS = [
  {
    q: "How do I book a clean?",
    a: "Tap any “Book” button to message us on WhatsApp, or call us. Tell us the service, your area in Lagos and the size of your space, and we'll send a quote and available times.",
  },
  {
    q: "What's the difference between regular and deep cleaning?",
    a: "Regular cleaning keeps a home in good shape — surfaces, floors, kitchen and bathrooms. Deep cleaning goes further: inside cabinets and appliances, grout, behind furniture and every detail. Most homes start with a deep clean, then move to regular visits.",
  },
  {
    q: "Do you bring cleaning supplies?",
    a: "Yes. Our team brings professional products and equipment. If you'd like us to use specific products you already have, just let us know.",
  },
  {
    q: "How long does a clean take?",
    a: "It depends on the size and condition of the space. Regular cleans usually take a few hours; deep and post-construction cleans take longer. We'll give you an estimate with your quote.",
  },
  {
    q: "Which areas do you cover?",
    a: "We're starting in Lagos — Island and Mainland. If you don't see your area listed, send us a message and we'll confirm. More Nigerian cities are coming soon.",
  },
  {
    q: "Do I need to be home during the clean?",
    a: "Not necessarily. Many customers let us in and head out. Just agree access arrangements with us when you book.",
  },
  {
    q: "Do you clean offices and short-let apartments?",
    a: "Yes. We clean offices, shops and short-let apartments as well as family homes. For short-lets we can turn the apartment around between guests.",
  },
  {
    q: "What should I do before a post-construction clean?",
    a: "Make sure the builders have finished and removed large debris, and that there's power and running water. We'll handle the dust, splashes and fine detail.",
  },
  {
    q: "Can I reschedule or cancel?",
    a: "Yes — just message us as early as you can and we'll find a new time that works for you.",
  },
];

export const AUDIENCES = [
  { icon: "House", title: "Homes & families", text: "Flats, duplexes and terraces kept fresh for busy households.", image: "/images/bedroom.jpg" },
  { icon: "KeyRound", title: "Short-let hosts", text: "Fast, guest-ready turnarounds between check-outs and check-ins.", image: "/images/shortlet-bedroom.jpg" },
  { icon: "Briefcase", title: "Offices & shops", text: "Clean, healthy workspaces your team and customers will notice.", image: "/images/office.jpg" },
  { icon: "Building2", title: "Estates & developers", text: "Post-construction cleans that get new builds ready to hand over.", image: "/images/apartment-block.jpg" },
];

// Which tasks each service covers — drives the comparison table.
export const COMPARE = [
  { task: "Dusting & wiping surfaces", regular: true, deep: true, post: true },
  { task: "Vacuuming & mopping floors", regular: true, deep: true, post: true },
  { task: "Kitchen & bathroom clean", regular: true, deep: true, post: true },
  { task: "Bed making & tidying", regular: true, deep: false, post: false },
  { task: "Inside cabinets & appliances", regular: false, deep: true, post: true },
  { task: "Tile & grout scrubbing", regular: false, deep: true, post: true },
  { task: "Behind & under furniture", regular: false, deep: true, post: true },
  { task: "Paint & cement splash removal", regular: false, deep: false, post: true },
  { task: "Fine construction dust removal", regular: false, deep: false, post: true },
];

export const ROOMS = [
  {
    id: "kitchen", label: "Kitchen", icon: "UtensilsCrossed", image: "/images/kitchen.jpg",
    tasks: ["Counters, splashbacks & sink scrubbed", "Cooker top & hob degreased", "Cabinet fronts & handles wiped", "Fridge & microwave exterior cleaned", "Floors swept & mopped", "Bins emptied & relined"],
  },
  {
    id: "bathroom", label: "Bathroom", icon: "Bath", image: "/images/bathroom.jpg",
    tasks: ["Toilet cleaned & disinfected", "Shower, tub & tiles scrubbed", "Sink, taps & mirrors polished", "Limescale & soap scum removed", "Floors mopped", "Towels neatly arranged"],
  },
  {
    id: "bedroom", label: "Bedrooms", icon: "BedDouble", image: "/images/bedroom.jpg",
    tasks: ["Beds made & linen changed (on request)", "Surfaces & headboards dusted", "Wardrobe fronts wiped", "Ceiling fan & light switches dusted", "Floors vacuumed & mopped", "General tidy-up"],
  },
  {
    id: "living", label: "Living areas", icon: "Sofa", image: "/images/regular-vacuum.jpg",
    tasks: ["Sofas & cushions vacuumed", "TV unit & shelves dusted", "Tables & surfaces wiped", "Window sills & frames cleaned", "Rugs & floors vacuumed", "Doors & handles disinfected"],
  },
];

export const PLANS = [
  { icon: "CalendarCheck", title: "One-off", text: "A single clean whenever you need it — perfect before guests, after parties or as a fresh start." },
  { icon: "Repeat", title: "Weekly", text: "Your home stays consistently spotless. Ideal for busy families and homes with kids or pets.", featured: true },
  { icon: "CalendarDays", title: "Bi-weekly", text: "A clean every two weeks keeps things fresh while you handle the light daily tidy." },
  { icon: "CalendarClock", title: "Monthly", text: "A regular reset for smaller spaces, or as a top-up between deep cleans." },
];
