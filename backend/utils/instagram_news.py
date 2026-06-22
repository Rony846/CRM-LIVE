"""Auto-post general news (India & world) to Instagram (@nofilterpromedia).

Pipeline: pull news RSS -> generate a branded news card image -> publish via the Instagram API
(graph.instagram.com content publishing). Headlines are rephrased + branded (not raw reposts) and
always carry source attribution.
"""
import os
import re
import io
import html
import asyncio
import hashlib
import logging

import base64

import httpx
import feedparser
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

IG_GRAPH = "https://graph.instagram.com"
HANDLE = "@" + os.environ.get("IG_HANDLE", "nofilternewsroom").lstrip("@").upper()   # channel @handle on cards

# General + viral/human-interest news feeds (India + world). Tune via env IG_NEWS_FEEDS ("Name|url,...").
DEFAULT_FEEDS = [
    ("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"),
    ("NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories"),
    ("NDTV Trending", "https://feeds.feedburner.com/ndtvnews-trending-news"),
    ("India Today", "https://www.indiatoday.in/rss/home"),
    ("The Better India", "https://www.thebetterindia.com/feed/"),
    ("News18", "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml"),
    ("Indian Express", "https://indianexpress.com/section/india/feed/"),
    ("The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss"),
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
]
# "Aurelian Noir" type system — Playfair Display (editorial serif headlines) + Montserrat (labels/body).
_FDIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
F_SERIF = os.path.join(_FDIR, os.environ.get("IG_HEADLINE_FONT", "Anton.ttf"))  # headline display font
F_SERIF_IT = os.path.join(_FDIR, "PlayfairDisplay-Italic.ttf")
F_SANS = os.path.join(_FDIR, "Montserrat.ttf")
# DejaVu fallback if the brand fonts are missing
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def _font(path, size, weight=None):
    """Load a (variable) TTF at a given weight; fall back to DejaVu if the file is missing."""
    try:
        f = ImageFont.truetype(path, size)
        if weight is not None:
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
        return f
    except Exception:
        return ImageFont.truetype(FONT_BOLD if (weight or 400) >= 600 else FONT_REG, size)


def get_feeds():
    raw = os.environ.get("IG_NEWS_FEEDS", "")
    if raw.strip():
        out = []
        for part in raw.split(","):
            if "|" in part:
                name, url = part.split("|", 1)
                out.append((name.strip(), url.strip()))
        if out:
            return out
    return DEFAULT_FEEDS


def _clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
    return re.sub(r"\s+", " ", s)


def news_id(link, title):
    return hashlib.sha1(((link or "") + "|" + (title or "")).encode("utf-8")).hexdigest()[:16]


def fetch_news(limit_per_feed=12):
    """Return a list of {id, source, title, summary, link, published} across the feeds, newest-ish first."""
    items = []
    for source, url in get_feeds():
        try:
            d = feedparser.parse(url)
            for e in d.entries[:limit_per_feed]:
                title = _clean(e.get("title"))
                if not title:
                    continue
                items.append({
                    "id": news_id(e.get("link"), title), "source": source,
                    "title": title, "summary": _clean(e.get("summary"))[:400],
                    "link": e.get("link"), "published": e.get("published", ""),
                })
        except Exception as ex:
            logger.error(f"IG news feed '{source}' failed: {ex}")
    return items


# headline keyword -> (Pexels search term, chip label). First match wins; order = most specific first.
CATEGORIES = [
    (("earthquake", "quake", "tremor", "flood", "cyclone", "landslide", "disaster", "tsunami"), "natural disaster", "ALERT"),
    (("court", "supreme court", "high court", "verdict", "judge", "petition", "bail", "trial"), "courtroom justice", "NATION"),
    (("police", "arrest", "crime", "murder", "firing", "fir", "booked", "custody"), "police india", "NATION"),
    (("election", "poll", "vote", "campaign", "constituency", "ballot"), "election voting india", "POLITICS"),
    (("parliament", "lok sabha", "rajya sabha", "bill", "minister", "cabinet", "government", "modi", "bjp", "congress"), "indian parliament", "POLITICS"),
    (("war", "military", "army", "missile", "border", "troops", "defence", "strike", "navy", "air force"), "military", "WORLD"),
    (("market", "sensex", "nifty", "rupee", "stocks", "economy", "gdp", "inflation", "rbi", "ipo", "shares"), "stock market", "BUSINESS"),
    (("cricket", "ipl", "match", "world cup", "bcci", "olympic", "football", "tournament"), "cricket stadium", "SPORT"),
    (("hospital", "health", "covid", "virus", "vaccine", "disease", "medical", "doctors"), "hospital medical", "HEALTH"),
    (("school", "university", "student", "exam", "education", "college", "neet", "upsc"), "university campus", "EDUCATION"),
    (("rain", "monsoon", "heatwave", "weather", "temperature", "climate", "pollution"), "monsoon rain india", "CLIMATE"),
    (("tech", "technology", "ai", "startup", "app", "software", "chip", "google", "apple", "space", "isro", "rocket"), "technology", "TECH"),
    (("airport", "flight", "airline", "train", "railway", "highway", "metro", "traffic"), "transport india", "NATION"),
    (("farmer", "agriculture", "crop", "wheat", "rice"), "agriculture india", "NATION"),
]
DEFAULT_QUERY = "india news city"
DEFAULT_LABEL = "INDIA"


def _match_category(headline, summary=""):
    text = f"{headline} {summary}".lower()
    tokens = set(re.findall(r"[a-z]+", text))   # whole-word match (so "app" != "approval", "ai" != "again")
    for keys, q, label in CATEGORIES:
        for k in keys:
            if (k in text) if " " in k else (k in tokens):   # phrases: substring; single words: token
                return q, label
    return DEFAULT_QUERY, DEFAULT_LABEL


def image_query(headline, summary=""):
    """Map a headline to a stock-photo search term (category-level, copyright-safe imagery)."""
    return _match_category(headline, summary)[0]


def category_label(headline, summary="", source=""):
    """Chip label for a story. World feeds default to WORLD when no keyword matches."""
    q, label = _match_category(headline, summary)
    if label == DEFAULT_LABEL and any(w in source.lower() for w in ("bbc", "world", "reuters", "guardian", "al jazeera")):
        return "WORLD"
    return label


# Realistic cinematic look by default (founder: "Tatva looks real, ours don't", 2026-06-07).
# Still copyright/misinformation-safe: symbolic, anonymous/silhouetted figures only, no real people,
# no text, no logos. Reversible to the old flat-cartoon style via env IG_AI_STYLE.
_AI_STYLE = os.environ.get("IG_AI_STYLE",
            ("Cinematic, photorealistic editorial illustration for a premium news page. Realistic lighting, "
             "depth of field, rich textures and atmosphere — looks like a high-end rendered film still, NOT a "
             "flat cartoon or vector graphic. Moody cinematic colour grade with subtle gold (#E9C349) and "
             "crimson (#D81E2C) accents. One strong central subject, dramatic composition, generous negative "
             "space. Absolutely NO text, letters, numbers or words; no real, famous or identifiable people "
             "(anonymous or silhouetted figures only, faces hidden or turned away); no logos or watermarks."))


async def generate_ai_cartoon(concept):
    """Generate a copyright-safe editorial CARTOON (PNG bytes) for a symbolic `concept`, on-brand palette,
    via OpenAI gpt-image-1. Returns None if no key / failure."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    model = os.environ.get("IG_IMAGE_MODEL", "gpt-image-1")
    quality = os.environ.get("IG_IMAGE_QUALITY", "medium")
    prompt = f"{_AI_STYLE}\nScene to illustrate: {concept}"[:950]
    try:
        async with httpx.AsyncClient(timeout=200) as cl:
            r = await cl.post("https://api.openai.com/v1/images/generations",
                              headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                              json={"model": model, "prompt": prompt, "n": 1, "size": "1024x1024",
                                    "quality": quality})
            if r.status_code != 200:
                logger.error(f"AI cartoon gen {r.status_code}: {r.text[:200]}")
                return None
            d = (r.json().get("data") or [{}])[0]
            if d.get("b64_json"):
                return base64.b64decode(d["b64_json"])
            if d.get("url"):
                im = await cl.get(d["url"])
                return im.content if im.status_code == 200 else None
    except Exception as ex:
        logger.error(f"AI cartoon gen failed: {ex}")
    return None


async def fetch_pexels_image(query, seed=""):
    """Fetch one square stock photo (JPEG bytes) from Pexels for `query`. Returns None if no key /
    no result. License: free for commercial use, no attribution required."""
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as cl:
            r = await cl.get("https://api.pexels.com/v1/search",
                             params={"query": query, "orientation": "square", "per_page": 15, "size": "large"},
                             headers={"Authorization": key})
            if r.status_code != 200:
                logger.error(f"Pexels search '{query}' -> {r.status_code}: {r.text[:200]}")
                return None
            photos = (r.json() or {}).get("photos", [])
            if not photos:
                return None
            idx = int(hashlib.sha1((query + seed).encode()).hexdigest(), 16) % len(photos)  # vary per story
            src = photos[idx].get("src", {})
            url = src.get("large2x") or src.get("large") or src.get("original")
            if not url:
                return None
            im = await cl.get(url)
            return im.content if im.status_code == 200 else None
    except Exception as ex:
        logger.error(f"Pexels fetch '{query}' failed: {ex}")
        return None


SS_API = "https://api.shutterstock.com/v2"
_STOP = {"the", "a", "an", "of", "in", "on", "to", "for", "and", "as", "at", "by", "with", "from",
         "over", "after", "amid", "says", "said", "new", "his", "her", "its", "but", "not", "into",
         # generic governance/common capitalised words that cause WRONG image matches — never search on these
         "governor", "governors", "centre", "center", "state", "states", "board", "government", "govt",
         "ministry", "minister", "council", "committee", "cabinet", "union", "opposition", "speaker",
         "assembly", "scheme", "report", "project", "plan", "district", "districts", "city", "highway",
         "road", "bench", "panel", "house", "chief", "president", "leader", "member", "members",
         "official", "officials", "people", "nation", "national", "department", "authority", "commission",
         "bill", "act"}   # NB: keep "court" OUT so the phrase "Supreme Court"/"High Court" survives intact


# common words that frequently START a headline but are NOT entities (adjectives/verbs/quantifiers).
# A lone capitalised first word is dropped only if it's one of these — real leading proper nouns
# (Mumbai, Modi, Waqf) survive.
_LEAD_STOP = {"moderate", "heavy", "major", "minor", "new", "top", "big", "huge", "massive", "small",
              "several", "many", "two", "three", "four", "five", "six", "seven", "ten", "over", "after",
              "amid", "despite", "following", "key", "first", "second", "third", "more", "most", "high",
              "low", "early", "late", "breaking", "exclusive", "watch", "video", "live", "now", "why",
              "how", "what", "when", "where", "who", "whose", "which", "experts", "sources", "study",
              "studies", "poll", "survey", "group", "team", "fresh", "latest", "special", "full",
              "another", "one", "deadly", "record", "stunning", "shocking", "viral", "former", "local",
              "man", "woman", "men", "women", "family", "no", "yes", "up", "down", "amid",
              "thousands", "hundreds", "millions", "lakhs", "crores", "dozens", "scores", "several"}


def editorial_terms(headline):
    """Proper-noun phrases from a headline — used to target a precise photo search AND to verify the
    chosen photo matches the story. Extracts runs of consecutive capitalised words. A LONE capitalised
    word at the very start is dropped only if it's a common headline-leading word (_LEAD_STOP) — real
    leading proper nouns are kept. Multi-word runs (e.g. 'Narendra Modi', 'Lok Sabha') are kept."""
    words = headline.split()
    runs, cur = [], []
    for i, w in enumerate(words):
        cw = re.sub(r"[^A-Za-z.&'-]", "", w)
        if cw and cw[0].isupper() and cw.lower() not in _STOP and len(cw) > 1:
            cur.append((i, cw))
        elif cur:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    phrases, seen = [], set()
    for run in runs:
        if run[0][0] == 0 and len(run) == 1 and run[0][1].lower() in _LEAD_STOP:
            continue                                 # sentence-initial common word -> skip
        phrase = " ".join(c[1] for c in run)
        if phrase.lower() not in seen:
            seen.add(phrase.lower())
            phrases.append(phrase)
    phrases.sort(key=lambda p: -len(p))             # longest / most specific first
    return phrases


def _entity_words(phrases):
    """Individual significant words across entity phrases, for caption/title matching."""
    out, seen = [], set()
    for p in phrases:
        for w in p.split():
            if len(w) > 2 and w.lower() not in seen:
                seen.add(w.lower())
                out.append(w.lower())
    return out


async def fetch_shutterstock_editorial(headline, category_query="", seed=""):
    """Fetch a REAL editorial event photo (JPEG bytes) from Shutterstock Editorial for this headline.
    Safety gate: only returns a photo whose caption mentions a named entity from the headline — otherwise
    returns None so the caller falls back to generic stock (never auto-posts a wrong face). Requires
    SHUTTERSTOCK_API_TOKEN + an active editorial subscription on the account."""
    token = os.environ.get("SHUTTERSTOCK_API_TOKEN")
    if not token:
        return None
    country = os.environ.get("SHUTTERSTOCK_EDITORIAL_COUNTRY", "IND")
    terms = editorial_terms(headline)
    query = " ".join(terms[:4]) or category_query
    if not query:
        return None
    lic_type = os.environ.get("SHUTTERSTOCK_EDITORIAL_LICENSE", "editorial")
    headers = {"Authorization": f"Bearer {token}"}
    lowterms = _entity_words(terms)
    try:
        async with httpx.AsyncClient(timeout=45) as cl:
            r = await cl.get(f"{SS_API}/editorial/images/search", headers=headers,
                             params={"query": query, "country": country, "sort": "newest", "per_page": 25})
            if r.status_code != 200:
                logger.error(f"Shutterstock editorial search {r.status_code}: {r.text[:200]}")
                return None
            data = (r.json() or {}).get("data", [])
            # safety gate: pick the newest asset whose caption mentions a headline entity
            chosen = None
            for a in data:
                cap = (a.get("description") or a.get("title") or "").lower()
                if not lowterms or any(t in cap for t in lowterms):
                    chosen = a
                    break
            if not chosen:
                logger.info(f"Shutterstock: no confident match for '{query}' — falling back to stock")
                return None
            eid = chosen.get("id")
            lic = await cl.post(f"{SS_API}/editorial/images/licenses", headers=headers,
                                json={"editorial_images": [{"editorial_id": eid, "license": lic_type}],
                                      "country": country})
            if lic.status_code not in (200, 201):
                logger.error(f"Shutterstock license {lic.status_code}: {lic.text[:250]}")
                return None
            ld = (lic.json() or {}).get("data", [])
            dl = (ld[0].get("download") or {}).get("url") if ld else None
            if not dl:
                logger.error(f"Shutterstock license returned no download url: {str(lic.json())[:250]}")
                return None
            im = await cl.get(dl)
            return im.content if im.status_code == 200 else None
    except Exception as ex:
        logger.error(f"Shutterstock editorial fetch failed: {ex}")
        return None


WIKI_COMMONS_API = "https://commons.wikimedia.org/w/api.php"
_FREE_LICENSE_HINTS = ("cc-by", "cc by", "cc0", "public domain", "pdm", "godl", "attribution", "creative commons")
# non-photographic files we never want behind a news card
_BAD_TITLE = ("logo", "seal", "flag", "coat of arms", "map", "screenshot", "diagram", "icon",
              "poster", "document", "letter", "stamp", "emblem", "chart", "graph", "banner",
              "sign", "cover", "scan", "manuscript", "drawing", "painting", "cartoon", "sketch",
              "label", "ticket", "certificate", "graffiti", "plaque", "blank", "template")


def _is_world_source(source):
    return any(w in (source or "").lower() for w in ("bbc", "world", "reuters", "guardian", "al jazeera"))


# foreign country/nationality words — used to drop off-topic foreign images from INDIAN stories
# (e.g. "Anti-Corruption Bureau" wrongly matching Ukraine's, "Supreme Court" matching the UK/US one)
_FOREIGN_TERMS = {"ukraine", "ukrainian", "ukraines", "pakistan", "pakistani", "china", "chinese",
                  "russia", "russian", "american", "america", "usa", "british", "britain", "england",
                  "french", "france", "german", "germany", "nepal", "nepali", "bangladesh", "bangladeshi",
                  "afghan", "afghanistan", "canada", "canadian", "australia", "australian", "japan",
                  "japanese", "korea", "korean", "european", "europe", "indonesia", "indonesian",
                  "philippines", "malaysia", "malaysian", "srilanka", "lankan", "iranian", "iran"}


async def fetch_wikimedia_images(headline, source="", n=1):
    """Up to `n` DISTINCT real, FREE-licensed photos genuinely related to the headline's named entity,
    from Wikimedia Commons (highest-resolution, India-biased for Indian sources). Returns a list of
    (bytes, credit). Used to build multi-image carousels with only on-topic photos."""
    terms = editorial_terms(headline)
    if not terms:
        return []
    base = [terms[0]]
    if len(terms) >= 2:
        base.append(" ".join(terms[:2]))
    bias = "" if _is_world_source(source) else " India"
    queries = ([b + bias for b in base] + base) if bias else base
    lowterms = _entity_words(terms)
    # require the FULL primary name in the file title (not just a common surname like "Reddy"/"Khan"),
    # so "Revanth Reddy" never matches a different "Reddy". Falls back to any-word for initials-only names.
    primary_words = re.findall(r"[a-z]{3,}", terms[0].lower())
    ua = {"User-Agent": "NoFilterProMedia/1.0 (Instagram news cards; contact admin@musclegrid.in)"}
    cand = {}   # url -> (res, credit)
    try:
        async with httpx.AsyncClient(timeout=45, headers=ua) as cl:
            for q in queries:
                r = await cl.get(WIKI_COMMONS_API, params={
                    "action": "query", "generator": "search", "gsrsearch": f"{q} filetype:bitmap",
                    "gsrnamespace": 6, "gsrlimit": 16, "prop": "imageinfo",
                    "iiprop": "url|mime|extmetadata|size", "iiurlwidth": 2000, "format": "json"})
                if r.status_code != 200:
                    continue
                for p in (((r.json() or {}).get("query") or {}).get("pages", {}) or {}).values():
                    ii = (p.get("imageinfo") or [{}])[0]
                    if ii.get("mime", "") != "image/jpeg":      # JPEG = real photos; PNG/SVG = logos/graphics
                        continue
                    w, h = ii.get("width") or 0, ii.get("height") or 0
                    if w < 1200 or h < 800:
                        continue
                    title = (p.get("title") or "").lower()
                    if any(b in title for b in _BAD_TITLE):
                        continue
                    if primary_words:                              # require the full primary name
                        if not all(pw in title for pw in primary_words):
                            continue
                    elif not any(t in title for t in lowterms):    # initials-only fallback
                        continue
                    # for Indian stories, drop images tagged to a foreign country (e.g. a generic name like
                    # "Anti-Corruption Bureau" matching Ukraine's) — keeps multi-image strictly on-topic
                    if not _is_world_source(source) and (set(re.findall(r"[a-z]+", title)) & _FOREIGN_TERMS):
                        continue
                    meta = ii.get("extmetadata") or {}
                    lic = (meta.get("LicenseShortName", {}) or {}).get("value", "")
                    if not any(h2 in lic.lower() for h2 in _FREE_LICENSE_HINTS):
                        continue
                    author = re.sub(r"<[^>]+>", "", (meta.get("Artist", {}) or {}).get("value", "")) or "Unknown"
                    author = re.sub(r"\s+", " ", author).strip()[:60]
                    url = ii.get("thumburl") or ii.get("url")
                    if url and (url not in cand or cand[url][0] < w * h):
                        cand[url] = (w * h, f"{author} / {lic} via Wikimedia Commons")
                if len(cand) >= n * 4:
                    break
            out, seen = [], set()
            for url, (_res, credit) in sorted(cand.items(), key=lambda kv: -kv[1][0]):
                if len(out) >= n:
                    break
                im = await cl.get(url)
                if im.status_code == 200 and im.content:
                    h = hashlib.md5(im.content).hexdigest()
                    if h not in seen:
                        seen.add(h)
                        out.append((im.content, credit))
            return out
    except Exception as ex:
        logger.error(f"Wikimedia fetch failed: {ex}")
        return []


async def fetch_wikimedia_image(headline, seed="", source=""):
    """Single best on-topic Wikimedia photo (bytes, credit), or (None, None)."""
    imgs = await fetch_wikimedia_images(headline, source=source, n=1)
    return imgs[0] if imgs else (None, None)


def _cover(im, W, H):
    """Resize+center-crop an image to exactly WxH (CSS object-fit: cover)."""
    iw, ih = im.size
    scale = max(W / iw, H / ih)
    nw, nh = max(W, int(iw * scale)), max(H, int(ih * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    return im.crop((left, top, left + W, top + H))


def _wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _headline_segments(headline):
    """Tag each word: 'ent' (a named entity -> gold), 'num' (contains a digit/% -> orange), else 'base'
    (white). Drives the highlighted-headline look so the text isn't flat."""
    ent_words = set()
    for p in editorial_terms(headline):
        for w in p.split():
            ent_words.add(w.lower().strip(".,'’"))
    segs = []
    for w in headline.split():
        bare = re.sub(r"[^A-Za-z0-9%]", "", w).lower()
        if re.search(r"\d", w):
            kind = "num"
        elif bare in ent_words or (w.isupper() and len(re.sub(r"[^A-Za-z]", "", w)) >= 2):
            kind = "ent"
        else:
            kind = "base"
        segs.append((w, kind))
    return segs


def _wrap_segments(draw, segs, font, max_w):
    """Word-wrap a list of (word, kind) into lines, preserving the per-word kind."""
    space = draw.textlength(" ", font=font)
    lines, cur, curw = [], [], 0
    for word, kind in segs:
        ww = draw.textlength(word, font=font)
        add = ww + (space if cur else 0)
        if cur and curw + add > max_w:
            lines.append(cur)
            cur, curw = [(word, kind)], ww
        else:
            cur.append((word, kind))
            curw += add
    if cur:
        lines.append(cur)
    return lines


def _line_w(draw, line, font):
    space = draw.textlength(" ", font=font)
    return sum(draw.textlength(w, font=font) for w, _ in line) + space * (len(line) - 1)


def _draw_colored_line(draw, xy, line, font, palette):
    x, y = xy
    space = draw.textlength(" ", font=font)
    for w, kind in line:
        draw.text((x, y), w, font=font, fill=palette[kind])
        x += draw.textlength(w, font=font) + space


# 4 highlight styles that rotate per post (bar colour + the ink colour for text sitting ON the bar).
# Non-highlighted words are always bright white over the photo scrim.
HL_STYLES = [
    {"name": "crimson", "bar": (216, 30, 44),   "ink": (255, 255, 255)},   # red bar, white text
    {"name": "ivory",   "bar": (243, 237, 226), "ink": (17, 17, 19)},      # cream bar, black text
    {"name": "gold",    "bar": (233, 195, 73),  "ink": (22, 17, 4)},       # gold bar, black text
    {"name": "teal",    "bar": (28, 122, 140),  "ink": (255, 255, 255)},   # teal bar, white text
]


def highlight_style(index):
    return HL_STYLES[index % len(HL_STYLES)]


def _draw_headline_runs(d, x0, y0, lines, hf, lh, rest_color, ink_color, bar_color,
                        hl_kinds=("ent", "num"), shadow=None, center_x=None):
    """Draw headline lines; the 'main part' (consecutive entity/number words) gets a tight highlight bar
    in `bar_color` with text in `ink_color`; all other words are `rest_color`. Bars hug the glyphs.
    If `center_x` is given, each line is centred around that x."""
    space = d.textlength(" ", font=hf)
    gb = hf.getbbox("AÁgjpq0")
    gt, gbot = gb[1], gb[3]
    pad_x = max(6, int(hf.size * 0.12))
    vpad = int(hf.size * 0.10)
    y = y0
    for line in lines:
        lx = x0 if center_x is None else int(center_x - _line_w(d, line, hf) / 2)
        pos, x = [], lx
        for w, kind in line:
            ww = d.textlength(w, font=hf)
            pos.append((x, ww, kind, w))
            x += ww + space
        i = 0
        while i < len(pos):                      # bars over runs of highlight words
            if pos[i][2] in hl_kinds:
                j = i
                while j + 1 < len(pos) and pos[j + 1][2] in hl_kinds:
                    j += 1
                d.rectangle([pos[i][0] - pad_x, y + gt - vpad,
                             pos[j][0] + pos[j][1] + pad_x, y + gbot + vpad], fill=bar_color)
                i = j + 1
            else:
                i += 1
        for x, ww, kind, w in pos:
            if kind in hl_kinds:
                d.text((x, y), w, font=hf, fill=ink_color)
            else:
                if shadow is not None:
                    d.text((x + 1, y + 2), w, font=hf, fill=shadow)
                d.text((x, y), w, font=hf, fill=rest_color)
        y += lh


def _tracked_w(draw, text, font, tracking):
    if not text:
        return 0
    return sum(draw.textlength(c, font=font) + tracking for c in text) - tracking


def _draw_tracked(draw, xy, text, font, fill, tracking, shadow=None):
    """Draw text with manual letter-spacing (Montserrat labels use wide tracking in this system).
    Optional shadow colour draws a 1px offset shadow first (legibility over photos)."""
    x, y = xy
    for c in text:
        if shadow is not None:
            draw.text((x + 1, y + 2), c, font=font, fill=shadow)
        draw.text((x, y), c, font=font, fill=fill)
        x += draw.textlength(c, font=font) + tracking
    return x


def _radial_glow(W, H, cx, cy, radius, color, max_alpha):
    """Soft burnt-orange radial glow (Aurelian Noir 'energy' focal effect). Returns RGBA layer."""
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    steps = 48
    for i in range(steps, 0, -1):
        r = radius * i / steps
        a = int(max_alpha * (1 - i / steps) ** 1.4)
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return g.filter(ImageFilter.GaussianBlur(28))


def make_news_card(headline, source, bg_bytes=None, category=None, subtitle=None, kicker=None, style=None):
    """1080x1080 'Aurelian Noir' editorial card — matte-black canvas, Playfair Display serif headline,
    Montserrat labels, 1px gold hairlines, a category chip and a burnt-orange focal glow. If bg_bytes
    (a stock photo) is given it's desaturated + dark-tinted behind the type. Returns JPEG bytes."""
    S = 2                               # supersample: render at 2x, downscale -> crystal-clear text
    W = H = 1080 * S
    M = 40 * S                          # safe-zone margin
    PAD = 64 * S                        # inner content x
    BG = (18, 20, 20)
    GOLD = (233, 195, 73)
    ORANGE = (255, 140, 0)
    WHITE = (255, 255, 255)
    RED = (227, 27, 35)                 # The Tatva-style highlight red

    def sf(path, size):                 # scaled font
        return _font(path, int(size * S), 700)

    # ---- base canvas (BRIGHT photo, lightly enhanced) ----
    has_photo = False
    if bg_bytes:
        try:
            ph = _cover(Image.open(io.BytesIO(bg_bytes)).convert("RGB"), W, H)
            ph = ImageEnhance.Color(ph).enhance(1.05)
            ph = ImageEnhance.Brightness(ph).enhance(1.03)
            ph = ImageEnhance.Contrast(ph).enhance(1.04)
            img = ph
            has_photo = True
        except Exception as ex:
            logger.error(f"bg treatment failed, falling back to matte: {ex}")
            img = Image.new("RGB", (W, H), BG)
    else:
        img = Image.new("RGB", (W, H), BG)

    maxw = W - 2 * PAD
    cat = (category or "NEWS").upper()
    kick = (kicker or cat).upper()

    if has_photo:
        # ===== "The Tatva" style: full-bleed photo + bottom text block =====
        sc = Image.new("L", (1, H))     # darken bottom ~half so white text reads, photo stays bright above
        scp = sc.load()
        for yy in range(H):
            scp[0, yy] = int(238 * (max(0.0, (yy - H * 0.40) / (H * 0.60)) ** 1.25))
        img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, sc.resize((W, H))).convert("RGB")
        d = ImageDraw.Draw(img)

        kicker_f = sf(F_SANS, 22)
        sub_f = sf(F_SANS, 22)
        foot_f = sf(F_SANS, 18)
        segs = _headline_segments(headline)
        for size in (54, 49, 44, 40, 36):       # auto-fit headline
            hf = sf(F_SERIF, size)
            hlines = _wrap_segments(d, segs, hf, maxw)
            lh = int(size * S * 1.3)            # generous leading so lines never touch
            if len(hlines) * lh <= int(H * 0.34):
                break
        hlines = hlines[:4]

        sub_lines = _wrap(d, subtitle, sub_f, maxw)[:2] if subtitle else []
        sub_lh = int(22 * S * 1.42)
        kick_lh = int(22 * S * 1.3)

        fy = H - M - 22 * S                                  # footer baseline
        sub_top = fy - 16 * S - len(sub_lines) * sub_lh
        head_bottom = sub_top - (16 * S if sub_lines else 8 * S)
        head_top = head_bottom - len(hlines) * lh
        kick_top = head_top - 10 * S - kick_lh

        st = style or HL_STYLES[0]
        kshow = kick if _tracked_w(d, kick, kicker_f, 3) <= maxw else cat
        _draw_tracked(d, (PAD, kick_top), kshow, kicker_f, WHITE, tracking=3 * S, shadow=(0, 0, 0))
        _draw_headline_runs(d, PAD, head_top, hlines, hf, lh, WHITE, st["ink"], st["bar"], shadow=(0, 0, 0))
        sy = sub_top
        for ln in sub_lines:
            d.text((PAD + 1, sy + 2), ln, font=sub_f, fill=(0, 0, 0))
            d.text((PAD, sy), ln, font=sub_f, fill=(235, 235, 235))
            sy += sub_lh
        _draw_tracked(d, (PAD, fy), f"SOURCE: {source.upper()}", foot_f, (215, 215, 215), 3, shadow=(0, 0, 0))
        handle = HANDLE
        hw = _tracked_w(d, handle, foot_f, 3)
        _draw_tracked(d, (W - PAD - hw, fy), handle, foot_f, ORANGE, 3, shadow=(0, 0, 0))
    else:
        # ===== matte (no photo): large headline, orange glow =====
        img = Image.alpha_composite(img.convert("RGBA"),
                                    _radial_glow(W, H, cx=W * 0.30, cy=H * 0.62, radius=600,
                                                 color=ORANGE, max_alpha=48)).convert("RGB")
        d = ImageDraw.Draw(img)
        chip_f = sf(F_SANS, 20)
        cw = _tracked_w(d, cat, chip_f, 4)
        d.rectangle([PAD, M + 22 * S, PAD + cw + 36 * S, M + 66 * S], fill=ORANGE)
        _draw_tracked(d, (PAD + 18 * S, M + 34 * S), cat, chip_f, (20, 14, 0), tracking=4)
        segs = _headline_segments(headline)
        top, bottom = M + 130 * S, H - M - 130 * S
        for size in (78, 70, 62, 56, 50, 44):
            hf = sf(F_SERIF, size)
            lines = _wrap_segments(d, segs, hf, maxw)
            lh = int(size * S * 1.16)
            if len(lines) * lh <= (bottom - top):
                break
        lines = lines[:8]
        y = top + max(0, (bottom - top - len(lines) * lh) // 2)
        d.rectangle([M + 4 * S, y - 4 * S, M + 10 * S, y + len(lines) * lh - 2 * S], fill=GOLD)
        for ln in lines:
            _draw_colored_line(d, (PAD, y), ln, hf, {"base": WHITE, "ent": GOLD, "num": ORANGE})
            y += lh
        foot_f = sf(F_SANS, 18)
        fy = H - M - 38 * S
        _draw_tracked(d, (PAD, fy), f"SOURCE: {source.upper()}", foot_f, GOLD, 3)
        handle = HANDLE
        hw = _tracked_w(d, handle, foot_f, 3)
        _draw_tracked(d, (W - PAD - hw, fy), handle, foot_f, ORANGE, 3)

    # downscale 2x -> 1080 (supersampled, crisp) + mild sharpen + 4:4:4 JPEG (no colour-edge grain)
    img = img.convert("RGB").resize((1080, 1080), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=95, subsampling=0)
    return buf.getvalue()


def make_photo_slide(bg_bytes, source=None, category=None):
    """A clean, near-full-bleed BRIGHT photo slide — no headline, just the image (related to the post)
    with a small @handle watermark + a thin gold corner accent. Used as slides 2..n in a carousel."""
    W = H = 1080
    M, PAD = 40, 64
    GOLD = (233, 195, 73)
    ORANGE = (255, 140, 0)
    try:
        img = _cover(Image.open(io.BytesIO(bg_bytes)).convert("RGB"), W, H)
    except Exception:
        img = Image.new("RGB", (W, H), (18, 20, 20))
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=85, threshold=3))
    # gentle bottom scrim so the watermark stays readable
    col = Image.new("L", (1, H))
    cp = col.load()
    for yy in range(H):
        cp[0, yy] = int(170 * (max(0.0, (yy - (H - 130)) / 130)) ** 1.2)
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, col.resize((W, H))).convert("RGB")
    d = ImageDraw.Draw(img)
    # thin gold corner accent (top-left)
    d.line([(M, M), (M + 70, M)], fill=GOLD, width=4)
    d.line([(M, M), (M, M + 70)], fill=GOLD, width=4)
    # small handle watermark (bottom-right)
    f = _font(F_SANS, 19, 700)
    handle = HANDLE
    hw = _tracked_w(d, handle, f, 3)
    _draw_tracked(d, (W - PAD - hw, H - M - 30), handle, f, ORANGE, 3, shadow=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=95)
    return buf.getvalue()


def make_detail_slide(text, source, category=None, bg_bytes=None, kicker=None, style=None):
    """A carousel DETAIL slide — the `text` (one distinct point about the story, NOT the headline) is the
    hero, with entity words highlighted in the post's style, over a darkened on-topic photo. Generous
    line spacing so lines never touch. Supersampled. Returns JPEG bytes."""
    S = 2
    W = H = 1080 * S
    M, PAD = 40 * S, 64 * S
    ORANGE = (255, 140, 0)
    WHITE = (255, 255, 255)
    st = style or HL_STYLES[0]

    def sf(path, size):
        return _font(path, int(size * S), 700)

    if bg_bytes:
        try:
            ph = _cover(Image.open(io.BytesIO(bg_bytes)).convert("RGB"), W, H)
            ph = ImageEnhance.Color(ph).enhance(0.6)
            img = Image.blend(ph, Image.new("RGB", (W, H), (0, 0, 0)), 0.62)
        except Exception:
            img = Image.new("RGB", (W, H), (16, 17, 19))
    else:
        img = Image.new("RGB", (W, H), (16, 17, 19))
    d = ImageDraw.Draw(img)
    maxw = W - 2 * PAD

    kicker_f = sf(F_SANS, 22)
    ktext = (kicker or (category or "NEWS")).upper()
    kw = _tracked_w(d, ktext, kicker_f, 3 * S)
    _draw_tracked(d, ((W - kw) // 2, M + 30 * S), ktext, kicker_f, WHITE, 3 * S, shadow=(0, 0, 0))

    segs = _headline_segments(text)
    for size in (44, 40, 36, 32, 29):
        hf = sf(F_SERIF, size)
        lines = _wrap_segments(d, segs, hf, maxw)
        lh = int(size * S * 1.36)                       # generous leading — no overlap
        if len(lines) * lh <= int(H * 0.46):
            break
    lines = lines[:8]
    # vertically centre the text block between the kicker and the footer; lines centred horizontally
    top_lim, bot_lim = M + 110 * S, H - M - 80 * S
    block_h = len(lines) * lh
    y = top_lim + max(0, (bot_lim - top_lim - block_h) // 2)
    cx = W // 2
    d.rectangle([cx - 45 * S, y - 26 * S, cx + 45 * S, y - 22 * S], fill=st["bar"])   # centred accent rule
    _draw_headline_runs(d, PAD, y, lines, hf, lh, WHITE, st["ink"], st["bar"], shadow=(0, 0, 0), center_x=cx)

    foot_f = sf(F_SANS, 18)
    fy = H - M - 22 * S
    _draw_tracked(d, (PAD, fy), f"SOURCE: {source.upper()}", foot_f, (215, 215, 215), 3, shadow=(0, 0, 0))
    handle = HANDLE
    hw = _tracked_w(d, handle, foot_f, 3)
    _draw_tracked(d, (W - PAD - hw, fy), handle, foot_f, ORANGE, 3, shadow=(0, 0, 0))

    img = img.convert("RGB").resize((1080, 1080), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=95, subsampling=0)
    return buf.getvalue()


def make_reel_slide(text, source, bg_bytes, category=None, kicker=None, style=None):
    """FULL-BLEED 9:16 (1080x1920) Reel slide — the photo fills the whole frame; kicker + highlighted
    text sit on a dark gradient at the bottom (no black bars). Supersampled. Returns JPEG bytes."""
    S = 2
    W, H = 1080 * S, 1920 * S
    M, PAD = 40 * S, 64 * S
    ORANGE = (255, 140, 0)
    WHITE = (255, 255, 255)
    st = style or HL_STYLES[0]

    def sf(path, size):
        return _font(path, int(size * S), 700)

    try:
        ph = _cover(Image.open(io.BytesIO(bg_bytes)).convert("RGB"), W, H)
    except Exception:
        ph = Image.new("RGB", (W, H), (18, 20, 20))
    ph = ImageEnhance.Color(ph).enhance(1.05)
    ph = ImageEnhance.Brightness(ph).enhance(1.03)
    ph = ImageEnhance.Contrast(ph).enhance(1.04)
    # darken only the lower ~half so the photo stays full and bright up top
    col = Image.new("L", (1, H))
    cp = col.load()
    for yy in range(H):
        cp[0, yy] = int(248 * (max(0.0, (yy - H * 0.45) / (H * 0.55)) ** 1.25))
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), ph, col.resize((W, H))).convert("RGB")
    d = ImageDraw.Draw(img)
    maxw = W - 2 * PAD

    segs = _headline_segments(text)
    for size in (58, 52, 47, 43, 39):
        hf = sf(F_SERIF, size)
        lines = _wrap_segments(d, segs, hf, maxw)
        lh = int(size * S * 1.26)
        if len(lines) * lh <= int(H * 0.30):
            break
    lines = lines[:5]

    foot_f = sf(F_SANS, 19)
    kicker_f = sf(F_SANS, 22)
    fy = H - M - 26 * S
    text_bottom = fy - 34 * S
    y0 = text_bottom - len(lines) * lh
    _draw_tracked(d, (PAD, y0 - 44 * S), (kicker or (category or "NEWS")).upper(), kicker_f, WHITE,
                  3 * S, shadow=(0, 0, 0))
    _draw_headline_runs(d, PAD, y0, lines, hf, lh, WHITE, st["ink"], st["bar"], shadow=(0, 0, 0))
    _draw_tracked(d, (PAD, fy), f"SOURCE: {source.upper()}", foot_f, (215, 215, 215), 3, shadow=(0, 0, 0))
    handle = HANDLE
    hw = _tracked_w(d, handle, foot_f, 3)
    _draw_tracked(d, (W - PAD - hw, fy), handle, foot_f, ORANGE, 3, shadow=(0, 0, 0))

    img = img.convert("RGB").resize((1080, 1920), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=95, subsampling=0)
    return buf.getvalue()


# ----- sentiment-matched public-domain audio for Reels -----
_MOOD_WORDS = {
    "somber": ("died", "dead", "killed", "death", "hospitalis", "accident", "fire", "flood", "quake",
               "earthquake", "blast", "attack", "murder", "suicide", "crash", "tragedy", "collapse",
               "cyclone", "landslide", "drown", "funeral", "mourn", "victim", "ventilator", "critical"),
    "uplifting": ("wins", "won", "award", "record", "launch", "inaugurat", "growth", "profit",
                  "breakthrough", "rescued", "success", "qualif", "gold", "tops", "celebrat", "wedding",
                  "festival", "historic", "milestone", "wins gold", "champion", "honoured"),
    "tense": ("war", "clash", "protest", "arrest", "scam", "fraud", "raid", "bribe", "court", "dispute",
              "row", "tension", "strike", "missile", "probe", "resign", "ban", "slams", "criticis",
              "alleg", "attacks", "sacked", "violence", "terror"),
}
_MOOD_AUDIO_QUERY = {
    "somber": "Albinoni Adagio G minor",
    "uplifting": "Vivaldi Spring La primavera Allegro",
    "tense": "Beethoven Symphony 5 Allegro con brio",
    "neutral": "Bach Air on the G string",
}
# reliable fallback (verified PD)
_FALLBACK_AUDIO = "File:Ludwig van Beethoven - Symphonie 5 c-moll - 1. Allegro con brio.ogg"


def news_mood(headline, summary=""):
    t = f"{headline} {summary}".lower()
    for mood in ("somber", "uplifting", "tense"):
        if any(w in t for w in _MOOD_WORDS[mood]):
            return mood
    return "neutral"


async def fetch_pd_audio(mood):
    """Fetch a public-domain/CC audio clip (bytes, ext, credit) matching the mood from Wikimedia Commons.
    Falls back to Beethoven 5 (PD). The track choice 'best suits' the news sentiment."""
    query = _MOOD_AUDIO_QUERY.get(mood, _MOOD_AUDIO_QUERY["neutral"])
    ua = {"User-Agent": "NoFilterNewsroom/1.0 (news reels)"}
    audio_mimes = ("application/ogg", "audio/ogg", "audio/mpeg", "audio/x-flac", "audio/flac", "audio/wav")
    async with httpx.AsyncClient(timeout=90, headers=ua) as cl:
        try:
            r = await cl.get(WIKI_COMMONS_API, params={
                "action": "query", "generator": "search", "gsrsearch": f"{query} filetype:audio",
                "gsrnamespace": 6, "gsrlimit": 12, "prop": "imageinfo",
                "iiprop": "url|mime|size|extmetadata", "format": "json"})
            for p in (((r.json() or {}).get("query") or {}).get("pages", {}) or {}).values():
                ii = (p.get("imageinfo") or [{}])[0]
                if ii.get("mime", "") not in audio_mimes:
                    continue
                lic = (ii.get("extmetadata", {}).get("LicenseShortName", {}) or {}).get("value", "")
                if not any(h in lic.lower() for h in _FREE_LICENSE_HINTS):
                    continue
                url = ii.get("url")
                if not url:
                    continue
                ext = url.rsplit(".", 1)[-1].lower()
                b = (await cl.get(url)).content
                if b and len(b) > 50000:
                    return b, ext, f"{query} ({lic}) via Wikimedia Commons"
        except Exception as ex:
            logger.error(f"PD audio search '{query}' failed: {ex}")
        # fallback
        try:
            r = await cl.get(WIKI_COMMONS_API, params={"action": "query", "titles": _FALLBACK_AUDIO,
                              "prop": "imageinfo", "iiprop": "url", "format": "json"})
            url = list((r.json().get("query", {}).get("pages", {}) or {}).values())[0]["imageinfo"][0]["url"]
            return (await cl.get(url)).content, "ogg", "Beethoven Symphony No. 5 (public domain)"
        except Exception as ex:
            logger.error(f"PD audio fallback failed: {ex}")
            return None, None, None


def make_context_slide(headline, body, source, category=None, bg_bytes=None, kicker=None, style=None):
    """The 'detailed text' carousel slide — kicker + headline (styled highlight) + a longer body paragraph
    over a heavily-darkened photo (or matte). Supersampled for crisp text. Returns JPEG bytes."""
    S = 2
    W = H = 1080 * S
    M, PAD = 40 * S, 64 * S
    GOLD = (233, 195, 73)
    ORANGE = (255, 140, 0)
    WHITE = (255, 255, 255)
    OFF = (214, 214, 214)
    st = style or HL_STYLES[0]

    def sf(path, size):
        return _font(path, int(size * S), 700)

    if bg_bytes:
        try:
            ph = _cover(Image.open(io.BytesIO(bg_bytes)).convert("RGB"), W, H)
            ph = ImageEnhance.Color(ph).enhance(0.55)
            img = Image.blend(ph, Image.new("RGB", (W, H), (0, 0, 0)), 0.66)   # heavy darken for reading
        except Exception:
            img = Image.new("RGB", (W, H), (16, 17, 19))
    else:
        img = Image.alpha_composite(Image.new("RGB", (W, H), (16, 17, 19)).convert("RGBA"),
                                    _radial_glow(W, H, W * 0.72, H * 0.30, 560 * S, ORANGE, 40)).convert("RGB")
    d = ImageDraw.Draw(img)
    maxw = W - 2 * PAD

    kicker_f = sf(F_SANS, 22)
    _draw_tracked(d, (PAD, M + 18 * S), (kicker or (category or "NEWS")).upper(), kicker_f, WHITE, 3 * S,
                  shadow=(0, 0, 0))

    segs = _headline_segments(headline)
    for size in (46, 42, 38, 34):
        hf = sf(F_SERIF, size)
        tl = _wrap_segments(d, segs, hf, maxw)
        lh = int(size * S * 1.18)
        if len(tl) * lh <= int(H * 0.30):
            break
    tl = tl[:5]
    ty = M + 64 * S
    _draw_headline_runs(d, PAD, ty, tl, hf, lh, WHITE, st["ink"], st["bar"], shadow=(0, 0, 0))
    ty += len(tl) * lh + 18 * S
    d.rectangle([PAD, ty, PAD + 90 * S, ty + 4 * S], fill=st["bar"])     # short accent rule
    ty += 26 * S

    bf = _font(F_SANS, int(23 * S), 400)        # body at regular weight
    blh = int(23 * S * 1.5)
    for ln in _wrap(d, body or headline, bf, maxw)[:10]:
        d.text((PAD + 1, ty + 2), ln, font=bf, fill=(0, 0, 0))
        d.text((PAD, ty), ln, font=bf, fill=OFF)
        ty += blh

    foot_f = sf(F_SANS, 18)
    fy = H - M - 22 * S
    _draw_tracked(d, (PAD, fy), f"SOURCE: {source.upper()}", foot_f, (215, 215, 215), 3, shadow=(0, 0, 0))
    handle = HANDLE
    hw = _tracked_w(d, handle, foot_f, 3)
    _draw_tracked(d, (W - PAD - hw, fy), handle, foot_f, ORANGE, 3, shadow=(0, 0, 0))

    img = img.convert("RGB").resize((1080, 1080), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=95, subsampling=0)
    return buf.getvalue()


async def _ig_wait_finished(cl, cid, token, tries=15):
    """Poll a media container until it finishes processing. Returns True if FINISHED."""
    for _ in range(tries):
        try:
            st = await cl.get(f"{IG_GRAPH}/{cid}", params={"fields": "status_code", "access_token": token})
            sc = (st.json() or {}).get("status_code")
        except Exception:
            sc = None
        if sc == "FINISHED":
            return True
        if sc == "ERROR":
            return False
        await asyncio.sleep(3)
    return True   # publish will surface a real error if it isn't ready


async def ig_create_and_publish_carousel(ig_user_id, token, image_urls, caption):
    """Publish a multi-image carousel (up to 10 slides) about one story: create a child container per
    image, then a CAROUSEL parent, then publish. Returns (ok, info=media_id or error)."""
    image_urls = [u for u in image_urls if u][:10]
    if len(image_urls) < 2:
        return False, "carousel needs >=2 images"
    async with httpx.AsyncClient(timeout=180) as cl:
        children = []
        for url in image_urls:
            r = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media",
                              data={"image_url": url, "is_carousel_item": "true", "access_token": token})
            try:
                cid = (r.json() or {}).get("id")
            except Exception:
                cid = None
            if not cid:
                return False, f"child container failed [{r.status_code}]: {r.text[:200]}"
            await _ig_wait_finished(cl, cid, token)
            children.append(cid)
        r2 = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media",
                           data={"media_type": "CAROUSEL", "children": ",".join(children),
                                 "caption": caption, "access_token": token})
        try:
            pid = (r2.json() or {}).get("id")
        except Exception:
            pid = None
        if not pid:
            return False, f"carousel container failed [{r2.status_code}]: {r2.text[:200]}"
        await _ig_wait_finished(cl, pid, token)
        r3 = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media_publish",
                           data={"creation_id": pid, "access_token": token})
        try:
            mid = (r3.json() or {}).get("id")
        except Exception:
            mid = None
        if not mid:
            return False, f"carousel publish failed [{r3.status_code}]: {r3.text[:200]}"
        return True, mid


async def ig_create_and_publish_reel(ig_user_id, token, video_url, caption, cover_url=None):
    """Publish a REEL (video) — the only post type that can carry baked-in audio. video_url must be a
    public MP4 (H.264/AAC). Returns (ok, info=media_id or error). Video processing can take a while."""
    async with httpx.AsyncClient(timeout=300) as cl:
        data = {"media_type": "REELS", "video_url": video_url, "caption": caption,
                "share_to_feed": "true", "access_token": token}
        if cover_url:
            data["cover_url"] = cover_url
        r1 = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media", data=data)
        try:
            cid = (r1.json() or {}).get("id")
        except Exception:
            cid = None
        if not cid:
            return False, f"reel container failed [{r1.status_code}]: {r1.text[:300]}"
        for _ in range(48):                       # video processing — poll up to ~4 min
            try:
                st = await cl.get(f"{IG_GRAPH}/{cid}", params={"fields": "status_code", "access_token": token})
                sc = (st.json() or {}).get("status_code")
            except Exception:
                sc = None
            if sc == "FINISHED":
                break
            if sc == "ERROR":
                return False, "reel processing ERROR"
            await asyncio.sleep(5)
        r2 = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media_publish",
                           data={"creation_id": cid, "access_token": token})
        try:
            mid = (r2.json() or {}).get("id")
        except Exception:
            mid = None
        if not mid:
            return False, f"reel publish failed [{r2.status_code}]: {r2.text[:300]}"
        return True, mid


async def ig_create_and_publish(ig_user_id, token, image_url, caption):
    """2-step Instagram content publish: create a media container (Instagram fetches image_url), wait
    for it to finish processing, then publish. Returns (ok: bool, info: str=media_id or error)."""
    async with httpx.AsyncClient(timeout=120) as cl:
        r1 = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media",
                           data={"image_url": image_url, "caption": caption, "access_token": token})
        try:
            d1 = r1.json()
        except Exception:
            d1 = {}
        cid = d1.get("id")
        if not cid:
            return False, f"container failed [{r1.status_code}]: {str(d1)[:300]}"
        for _ in range(12):
            try:
                st = await cl.get(f"{IG_GRAPH}/{cid}", params={"fields": "status_code", "access_token": token})
                sc = (st.json() or {}).get("status_code")
            except Exception:
                sc = None
            if sc == "FINISHED":
                break
            if sc == "ERROR":
                return False, "media container processing ERROR"
            await asyncio.sleep(3)
        r2 = await cl.post(f"{IG_GRAPH}/{ig_user_id}/media_publish",
                           data={"creation_id": cid, "access_token": token})
        try:
            d2 = r2.json()
        except Exception:
            d2 = {}
        mid = d2.get("id")
        if not mid:
            return False, f"publish failed [{r2.status_code}]: {str(d2)[:300]}"
        return True, mid
