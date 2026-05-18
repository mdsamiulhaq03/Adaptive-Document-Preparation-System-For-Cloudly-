import fs from 'fs';
import path from 'path';

export interface Section {
  id: string;
  title: string;
  text: string;
}

const PDF_PATH = process.env.PDF_PATH
  ? path.resolve(process.env.PDF_PATH)
  : path.resolve('./data/SLATEFALL_DOSSIER.pdf');

let _cachedSections: Section[] | null = null;

export async function parsePdf(): Promise<Section[]> {
  if (_cachedSections) return _cachedSections;

  // If PDF doesn't exist, return demo sections for development/testing
  if (!fs.existsSync(PDF_PATH)) {
    console.warn(`PDF not found at ${PDF_PATH}. Using synthetic demo content.`);
    _cachedSections = buildDemoSections();
    return _cachedSections;
  }

  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(PDF_PATH);
  const data = await pdfParse(buffer);

  _cachedSections = extractSections(data.text);
  return _cachedSections;
}

// Detect section headings: "Section N", "SECTION N", "Chapter N", numbered lines like "1.", "1 " etc.
function extractSections(rawText: string): Section[] {
  const lines = rawText.split('\n');
  const sections: Section[] = [];

  const HEADING_RE = /^(?:section|chapter)\s+(\d+)[:\.\s-]*(.*)?$/i;
  const NUMBERED_RE = /^(\d{1,2})\.\s+([A-Z].+)$/;

  let currentId = '';
  let currentTitle = '';
  let currentLines: string[] = [];
  let sectionCounter = 0;

  const flush = () => {
    if (currentId && currentLines.length > 0) {
      sections.push({
        id: currentId,
        title: currentTitle,
        text: currentLines.join('\n').trim(),
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(HEADING_RE);
    const numberedMatch = trimmed.match(NUMBERED_RE);

    if (headingMatch) {
      flush();
      sectionCounter++;
      currentId = headingMatch[1] || String(sectionCounter);
      currentTitle = (headingMatch[2] || `Section ${currentId}`).trim();
      currentLines = [];
    } else if (numberedMatch && parseInt(numberedMatch[1], 10) === sectionCounter + 1) {
      flush();
      sectionCounter++;
      currentId = numberedMatch[1];
      currentTitle = numberedMatch[2].trim();
      currentLines = [];
    } else {
      if (currentId) {
        currentLines.push(line);
      } else {
        // Text before first section — treat as section 0 (preamble)
        if (trimmed.length > 20) {
          if (!currentId) {
            currentId = '0';
            currentTitle = 'Preamble';
          }
          currentLines.push(line);
        }
      }
    }
  }

  flush();

  // If no sections detected, chunk the full text into synthetic sections of ~800 words
  if (sections.length < 2) {
    return chunkIntoSections(rawText);
  }

  return sections;
}

function chunkIntoSections(text: string, wordsPerChunk = 800): Section[] {
  const words = text.split(/\s+/);
  const sections: Section[] = [];
  const totalChunks = Math.ceil(words.length / wordsPerChunk);

  for (let i = 0; i < totalChunks; i++) {
    const chunk = words.slice(i * wordsPerChunk, (i + 1) * wordsPerChunk).join(' ');
    sections.push({
      id: String(i + 1),
      title: `Section ${i + 1}`,
      text: chunk,
    });
  }

  return sections;
}

// Demo sections used when PDF is absent (development / CI)
function buildDemoSections(): Section[] {
  const topics: Array<{ title: string; body: string }> = [
    {
      title: 'Introduction to Cryptography',
      body: `Cryptography is the practice of securing communications and data through mathematical techniques.
Modern cryptography relies on computational complexity. Symmetric encryption uses the same key for
encryption and decryption (e.g., AES-256). Asymmetric encryption uses public/private key pairs (e.g., RSA-2048).
Hash functions like SHA-256 produce fixed-length digests that are collision-resistant. Digital signatures
combine hashing and asymmetric keys to verify authenticity. Key management is a critical operational concern.
Certificate Authorities (CAs) issue X.509 certificates binding public keys to identities. TLS 1.3 removed
insecure cipher suites present in earlier versions. Perfect Forward Secrecy (PFS) ensures session keys
are ephemeral and cannot be retroactively decrypted even if long-term keys are compromised.`,
    },
    {
      title: 'Network Security Fundamentals',
      body: `Network security encompasses policies, practices, and technologies to prevent unauthorized access.
Firewalls filter traffic by rules; stateful firewalls track connection state. IDS/IPS systems detect or block
anomalous traffic. VPNs create encrypted tunnels over public networks using protocols like WireGuard or IPSec.
The OSI model has seven layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.
TCP establishes connections via three-way handshake (SYN, SYN-ACK, ACK). UDP is connectionless.
Port scanning techniques include SYN scan, connect scan, and UDP scan. Network segmentation limits blast
radius of breaches. Zero-trust architecture treats every request as untrusted regardless of network origin.`,
    },
    {
      title: 'Web Application Security',
      body: `OWASP Top 10 lists the most critical web application security risks. SQL injection occurs when
user input is unsanitized and embedded in SQL queries. XSS (Cross-Site Scripting) injects malicious scripts.
CSRF (Cross-Site Request Forgery) tricks authenticated users into submitting unauthorized requests.
IDOR (Insecure Direct Object Reference) exposes internal objects without authorization checks.
Content Security Policy (CSP) headers restrict sources of executable scripts. HTTPS with HSTS prevents
downgrade attacks. Authentication should use bcrypt/argon2 for password hashing. JWTs must be signed
and verified; never trust unverified payloads. Rate limiting prevents brute-force attacks.`,
    },
    {
      title: 'Threat Intelligence and OSINT',
      body: `Threat intelligence involves collecting and analyzing information about current and emerging threats.
OSINT (Open Source Intelligence) gathers data from publicly available sources. Shodan indexes internet-connected
devices; Censys and ZoomEye are alternatives. WHOIS records reveal domain registration data. Certificate
transparency logs expose issued certificates. LinkedIn, GitHub, and job postings reveal technology stacks.
IOCs (Indicators of Compromise) include malicious IPs, domains, hashes, and URLs. TTPs (Tactics, Techniques,
Procedures) describe attacker behavior catalogued in MITRE ATT&CK. Threat feeds like AlienVault OTX
aggregate community-submitted indicators. Attribution is difficult due to false-flag operations.`,
    },
    {
      title: 'Incident Response',
      body: `Incident response (IR) is the structured process for managing security incidents. NIST SP 800-61
defines four phases: Preparation, Detection/Analysis, Containment/Eradication/Recovery, Post-Incident.
Chain of custody documents evidence handling. Forensic imaging uses dd or specialized tools to create
bit-for-bit copies. Memory forensics captures volatile data with tools like Volatility. Log aggregation
(SIEM) correlates events across systems. Mean Time to Detect (MTTD) and Mean Time to Respond (MTTR)
are key metrics. Playbooks standardize response to known incident types. Tabletop exercises test IR plans
without live systems. Ransomware response prioritizes isolation before eradication.`,
    },
    {
      title: 'Malware Analysis',
      body: `Malware analysis techniques include static analysis (examining code without execution) and
dynamic analysis (running malware in a controlled environment). Sandboxes like Cuckoo automate dynamic
analysis. PE file format is standard for Windows executables; ELF for Linux. Entropy analysis detects
packed or encrypted sections. Strings extraction reveals hardcoded IPs, URLs, and registry keys. API
call monitoring tracks system interactions. Rootkits hide malware presence using kernel hooks. Ransomware
encrypts files and demands payment; modern variants use hybrid encryption. Fileless malware executes
in memory, evading file-based detection. C2 (Command and Control) infrastructure coordinates botnets.`,
    },
    {
      title: 'Cloud Security',
      body: `Cloud security shared responsibility model divides obligations between provider and customer.
IAM (Identity and Access Management) controls who can access what resources. Principle of least privilege
limits permissions to only what is necessary. S3 bucket misconfigurations have caused major data breaches;
always enable bucket policies and block public access unless required. Security groups act as virtual firewalls
for cloud instances. CloudTrail and similar audit logs record API activity. Encryption at rest and in transit
is baseline requirement. Kubernetes RBAC controls access to cluster resources. Secrets management (Vault,
AWS Secrets Manager) prevents hardcoded credentials. Container images should be scanned for vulnerabilities.`,
    },
    {
      title: 'Social Engineering and Phishing',
      body: `Social engineering exploits human psychology rather than technical vulnerabilities. Phishing uses
deceptive emails to steal credentials or deploy malware. Spear phishing targets specific individuals using
personalized information. Vishing uses voice calls; smishing uses SMS. Pretexting creates a fabricated scenario
to extract information. Baiting leaves infected media in accessible locations. Tailgating physically bypasses
access controls. Security awareness training reduces susceptibility. DMARC, DKIM, and SPF records authenticate
email senders and reduce spoofing. Simulated phishing campaigns measure organizational resilience. Red team
exercises test both technical and human defenses comprehensively.`,
    },
    {
      title: 'Penetration Testing Methodology',
      body: `Penetration testing simulates attacks to identify vulnerabilities before malicious actors do.
Phases include Reconnaissance, Scanning, Exploitation, Post-Exploitation, and Reporting. Rules of Engagement
(RoE) define scope, timing, and constraints. Black-box testing provides no prior knowledge; white-box
provides full access; grey-box is intermediate. Kali Linux is the standard pentesting distribution.
Metasploit Framework automates exploitation. Burp Suite proxies web traffic for web app testing. Nmap
performs network discovery and port scanning. Privilege escalation moves from low to high privileges.
Lateral movement explores the network after initial compromise. Reports must include risk ratings and
actionable remediation steps.`,
    },
    {
      title: 'Compliance and Risk Management',
      body: `Risk management identifies, assesses, and prioritizes information security risks. NIST CSF provides
a framework with five functions: Identify, Protect, Detect, Respond, Recover. ISO 27001 is an international
standard for information security management systems. GDPR governs personal data processing in the EU with
fines up to 4% of global annual revenue. PCI-DSS applies to organizations handling cardholder data.
HIPAA protects health information in the US. SOC 2 Type II audits service organizations' controls.
Risk appetite defines how much risk an organization accepts. BIA (Business Impact Analysis) identifies
critical processes. Quantitative risk assessment uses financial metrics; qualitative uses ratings like
High/Medium/Low. Vendor risk management assesses third-party security posture.`,
    },
  ];

  return topics.map((t, i) => ({
    id: String(i + 1),
    title: t.title,
    text: `Section ${i + 1}: ${t.title}\n\n${t.body}`,
  }));
}

export async function getSectionsByIds(ids: string[]): Promise<Section[]> {
  const sections = await parsePdf();
  return sections.filter((s) => ids.includes(s.id));
}
