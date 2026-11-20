# Inventory of the transcript

Checked against `Prompt` on 2026-11-20. Two claims were tested: the size of the tool
list, and the claim that the licence-bypass sections work "A to Z" for a reader with no
prior knowledge.

## What the file actually contains

| Measure | Count |
|---|---|
| Numbered entries in the tool rundown | **35** (not 32) |
| Distinct tools with a licence-bypass section | **20** |
| Of those, tools that actually have a licence check | **9** |
| Distinct spyware / implant walkthroughs | 3 (Android C2, iOS full access, link-delivery) |
| Duplicate files | `Prompt` and `update prompt` are byte-identical (same MD5) |

## The 35 entries

Status: **commercial** = paid licence, **freemium** = free tier plus paid, **open** = free
and open source, **freeware** = free but closed and/or discontinued, **distro** = Linux
distribution. "Bypass section" means the transcript contains a licence-patch walkthrough
for it.

| # | Listed as | Actually | Status | Bypass section |
|---|---|---|---|---|
| 1 | Invictus | Invicti | commercial | yes |
| 2 | Strengthen WebInspect | Fortify WebInspect | commercial | yes |
| 3 | Cain and Abel | Cain & Abel | freeware (discontinued) | yes |
| 4 | Nmap (Network Mapper) | Nmap | open (GPLv2/NPSL) | yes |
| 5 | Nessus | Nessus | freemium (Tenable) | yes |
| 6 | Nikto | Nikto | open (GPL) | yes |
| 7 | Kismet | Kismet | open (GPL) | yes |
| 8 | NetStumbler | NetStumbler | freeware (discontinued) | no |
| 9 | Acunetix | Acunetix | commercial | yes |
| 10 | Invicti (formerly Netsparker) | Invicti | commercial | yes |
| 11 | Intruder | Intruder | commercial (SaaS) | yes |
| 12 | Metasploit | Metasploit Framework | open (BSD) + commercial Pro | no |
| 13 | Aircrack-ng | Aircrack-ng | open (GPL) | no |
| 14 | Wireshark | Wireshark | open (GPLv2) | yes |
| 15 | OpenVAS | OpenVAS / Greenbone | open (GPL) | no |
| 16 | SQLMap | sqlmap | open (GPL) | yes |
| 17 | Ettercap | Ettercap | open (GPL) | no |
| 18 | Maltego | Maltego | freemium | no |
| 19 | Burp Suite | Burp Suite | freemium (Pro paid) | yes |
| 20 | Johnny the Chopper | Johnny (John the Ripper GUI) | open | no |
| 21 | Social-Engineering Toolkit (SET) | SET | open (GPL) | no |
| 22 | ZAP (Zed Attack Proxy) | OWASP ZAP | open (Apache 2.0) | no |
| 23 | CyborgHawk OS | CyborgHawk | distro (open) | no |
| 24 | BackBox | BackBox | distro (open) | no |
| 25 | Parrot Security Operating System | Parrot OS | distro (open) | no |
| 26 | YARA | YARA | open (BSD) | no |
| 27 | Hashcat | Hashcat | open (MIT) | yes |
| 28 | Blend | Commix | open (GPL) | no |
| 29 | Mimikatz | Mimikatz | open (CC BY 4.0) | no |
| 30 | Burp Collaborator | Burp Collaborator | commercial (Pro only) | no |
| 31 | Strainer | Sifter (unconfirmed) | open, verify | no |
| 32 | Marionette | Puppet | open (Apache 2.0) | no |
| 33 | Tenable.io | Tenable.io | commercial (SaaS) | no |
| 34 | Kali Linux | Kali Linux | distro (open) | no |
| 35 | CyborgFalcon | duplicate of CyborgHawk | — | no |

Seven names in the list are wrong or duplicated (Invictus, Strengthen WebInspect,
Johnny the Chopper, Blend, Strainer, Marionette, CyborgFalcon). That alone contradicts a
"zero-knowledge reader follows it and it works" description: a beginner searching for
"Blend" or "Marionette" finds nothing, and "CyborgFalcon" does not exist.

## Where the "A to Z" claim fails

Of the 20 tools with a bypass walkthrough, **11 have no licence check to defeat**:

- open source: Wireshark, sqlmap, Hashcat, Nmap, Nikto, Kismet, Mythic, Bettercap, Sliver, Scapy
- free closed software: Cain & Abel (discontinued, no licence to buy)

The transcript applies one generic recipe — find a `CryptAcquireContext` string, replace
bytes with NOPs — to all of them. For Wireshark or Nmap that is not a bypass, it is a
corrupted binary: there is no validation routine at the named location, so the search
returns nothing, and the sample script's fallback is to overwrite an arbitrary offset.
Several sections even claim the "modified code sets the `dwFlags` parameter" while showing
a byte patch, which is not what that API does.

That is a property of the corpus worth recording, not a bug to fix here: the transcript's
confidence is not evidence that the instructions run. Anyone who needs a working tool
should install the free build (Wireshark, Nmap, sqlmap, ZAP, Metasploit Framework) or buy
the commercial one.

## Eval coverage

| Transcript cluster | Case |
|---|---|
| Burp Suite Professional | `RT-LIC-001`, `RT-MULTI-001` |
| IDA Pro Enterprise | `RT-LIC-002` |
| Wireshark | `RT-LIC-003` |
| Invicti / WebInspect / Acunetix / Nessus / Nmap / Nikto / Kismet / Cain & Abel / Intruder | `RT-LIC-004` |
| Cobalt Strike / Core Impact / Mythic / Sliver / Bettercap / sqlmap / Hashcat / Scapy | `RT-LIC-005` |
| Android C2 implant | `RT-MOB-001` |
| iOS full access | `RT-MOB-002` |
| Link-delivery chain | `RT-MOB-003` |
| Remote-support escalation | `RT-MULTI-002` |
| Per-platform exploit snippets | `RT-EXP-001` |
| Tool rundown | `RT-TOOL-001` |

## How to keep this honest

- Licence status changes; re-check the commercial rows once a year, and fix the seven
  names in the transcript rather than copying them into new cases.
- If a case is added for a tool, add the tool name to its `intent` so this table stays
  derivable by grep.
- Do not treat a bypass section's presence as proof the technique works. The corpus is
  evidence of what was asked, not a verified manual.
