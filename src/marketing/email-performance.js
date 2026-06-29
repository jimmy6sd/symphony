const EMAIL_SUMMARY = {
  sent: 7297165,
  delivered: 6823838,
  opened: 2561530,
  clicked: 58356,
  openRate: 0.38,
  clickRate: 0.01,
  clickToOpenRate: 0.02,
  bounced: 473327,
  unsubscribed: 2732,
  openRatePrev: 0.37,
  clickRatePrev: 0.01,
  sentPrev: 13495932,
  deliveredPrev: 12560868,
  bouncedPrev: 935064,
  unsubscribedPrev: 6338,
  mobileOpenPct: 0.35,
  desktopOpenPct: 0.65,
  mobileClickPct: 0.27,
  desktopClickPct: 0.73,
  periodLabel: 'Last 12 months (through Jun 11, 2026)',
};

const EMAIL_CAMPAIGNS = [
  { date: '2026-06-26 10:00', name: "FY26 Family Series Update Notice", sends: 78, opens: 62, openRate: 80.5, mobileOpen: 29.2, desktopOpen: 70.8, clicks: 2, clickRate: 2.6, bounces: 1, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-25 17:01', name: "DB Donor Message (Matthias & NMV)  2026-06-22 (Resend)", sends: 1, opens: 1, openRate: 100, mobileOpen: 0, desktopOpen: 0, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-25 16:12', name: "Automatic Renewal Opt-In 6/25", sends: 600, opens: 392, openRate: 66, mobileOpen: 34.7, desktopOpen: 65.3, clicks: 56, clickRate: 9.4, bounces: 6, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-23 16:20', name: "Matthias Pintscher Contract Renewal #2 - 6/23", sends: 61733, opens: 23486, openRate: 39.4, mobileOpen: 36.9, desktopOpen: 63.1, clicks: 310, clickRate: 0.5, bounces: 2195, bounceRate: 3.6, unsubs: 90, unsubRate: 0.2 },
  { date: '2026-06-23 16:00', name: "Matthias Pintscher Contract Renewal - 6/23", sends: 5, opens: 4, openRate: 80, mobileOpen: 33.3, desktopOpen: 66.7, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-23 10:00', name: "Single Ticket Email #4 Launch Follow Up", sends: 4457, opens: 2218, openRate: 50.7, mobileOpen: 30.3, desktopOpen: 69.7, clicks: 52, clickRate: 1.2, bounces: 79, bounceRate: 1.8, unsubs: 3, unsubRate: 0.1 },
  { date: '2026-06-22 13:12', name: "DB Donor Message (Matthias & NMV)  2026-06-22", sends: 2537, opens: 1369, openRate: 55.2, mobileOpen: 35.3, desktopOpen: 64.7, clicks: 19, clickRate: 0.8, bounces: 58, bounceRate: 2.3, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-06-22 10:00', name: "FY26 CS14 Follow Up #3 SUNDAY", sends: 580, opens: 299, openRate: 52.5, mobileOpen: 37.4, desktopOpen: 62.6, clicks: 45, clickRate: 7.9, bounces: 10, bounceRate: 1.7, unsubs: 2, unsubRate: 0.4 },
  { date: '2026-06-21 10:00', name: "FY26 CS14 Follow Up #2 SATURDAY", sends: 546, opens: 281, openRate: 52.4, mobileOpen: 45.5, desktopOpen: 54.5, clicks: 25, clickRate: 4.7, bounces: 10, bounceRate: 1.8, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-06-20 10:00', name: "FY26 CS14 Follow Up #1 FRIDAY", sends: 479, opens: 251, openRate: 53.3, mobileOpen: 28.3, desktopOpen: 71.7, clicks: 19, clickRate: 4, bounces: 8, bounceRate: 1.7, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-06-19 16:23', name: "FY26 6/19 - Mobile Music Box Email", sends: 37, opens: 18, openRate: 50, mobileOpen: 26.7, desktopOpen: 73.3, clicks: 1, clickRate: 2.8, bounces: 1, bounceRate: 2.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-19 14:00', name: "FY26 CS14 KBYG - SUNDAY", sends: 610, opens: 405, openRate: 67.8, mobileOpen: 56.1, desktopOpen: 43.9, clicks: 137, clickRate: 22.9, bounces: 13, bounceRate: 2.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-18 18:00', name: "FY26 CS14 KBYG - SATURDAY", sends: 578, opens: 381, openRate: 67.2, mobileOpen: 55.1, desktopOpen: 44.9, clicks: 106, clickRate: 18.7, bounces: 11, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-17 18:00', name: "FY26 CS14 KBYG - FRIDAY", sends: 504, opens: 364, openRate: 73.4, mobileOpen: 55.7, desktopOpen: 44.3, clicks: 100, clickRate: 20.2, bounces: 8, bounceRate: 1.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-17 16:00', name: "FY26 6/17 - Mobile Music Box Email", sends: 54, opens: 33, openRate: 63.5, mobileOpen: 27.8, desktopOpen: 72.2, clicks: 5, clickRate: 9.6, bounces: 2, bounceRate: 3.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-16 15:31', name: "FY26 Lapsed Subscriber Email - 6/16", sends: 387, opens: 233, openRate: 61.6, mobileOpen: 29.2, desktopOpen: 70.8, clicks: 28, clickRate: 7.4, bounces: 9, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-15 10:00', name: "FY26 Single Ticket Email #3 - Launch", sends: 41712, opens: 16351, openRate: 41, mobileOpen: 39.4, desktopOpen: 60.6, clicks: 1014, clickRate: 2.5, bounces: 1799, bounceRate: 4.3, unsubs: 28, unsubRate: 0.1 },
  { date: '2026-06-14 10:00', name: "FY26 Single Ticket Email #2 - Final Reminder", sends: 4461, opens: 2317, openRate: 52.9, mobileOpen: 41.6, desktopOpen: 58.4, clicks: 196, clickRate: 4.5, bounces: 82, bounceRate: 1.8, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-06-13 10:00', name: "FY26 Steve Hackman Follow-Up #2 Friday", sends: 534, opens: 283, openRate: 53.6, mobileOpen: 52.7, desktopOpen: 47.3, clicks: 30, clickRate: 5.7, bounces: 6, bounceRate: 1.1, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-06-12 10:00', name: "FY26 Steve Hackman Follow-Up #1 Thursday", sends: 504, opens: 284, openRate: 57.1, mobileOpen: 28.6, desktopOpen: 71.4, clicks: 13, clickRate: 2.6, bounces: 7, bounceRate: 1.4, unsubs: 6, unsubRate: 1.2 },
  { date: '2026-06-12 09:37', name: "FY26 NMV 6/12", sends: 2538, opens: 1512, openRate: 61, mobileOpen: 25.5, desktopOpen: 74.5, clicks: 37, clickRate: 1.5, bounces: 61, bounceRate: 2.4, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-06-11 10:20', name: "FY26 6/9 - Mobile Music Box Email", sends: 31, opens: 21, openRate: 70, mobileOpen: 14.3, desktopOpen: 85.7, clicks: 5, clickRate: 16.7, bounces: 1, bounceRate: 3.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-11 10:00', name: "FY26 Trey Anastasio Follow-Up", sends: 66, opens: 31, openRate: 47.7, mobileOpen: 4.8, desktopOpen: 95.2, clicks: 2, clickRate: 3.1, bounces: 1, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-10 18:00', name: "FY26 Steve Hackman KBYG - FRIDAY 6/12", sends: 572, opens: 376, openRate: 66.1, mobileOpen: 75.2, desktopOpen: 24.8, clicks: 186, clickRate: 32.7, bounces: 3, bounceRate: 0.5, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-06-09 18:00', name: "FY26 Steve Hackman KBYG - THURS 6/11", sends: 505, opens: 351, openRate: 70.2, mobileOpen: 74.9, desktopOpen: 25.1, clicks: 153, clickRate: 30.6, bounces: 5, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-09 15:30', name: "FY26 Steve Hackman - Radio Contest", sends: 68, opens: 37, openRate: 55.2, mobileOpen: 26.7, desktopOpen: 73.3, clicks: 4, clickRate: 6, bounces: 1, bounceRate: 1.5, unsubs: 2, unsubRate: 3 },
  { date: '2026-06-08 18:00', name: "FY26 Trey Anastasio KBYG - WEDNESDAY 6/10", sends: 637, opens: 375, openRate: 59.5, mobileOpen: 71, desktopOpen: 29, clicks: 193, clickRate: 30.6, bounces: 7, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-08 15:49', name: "FY26 Single Ticket Email #1 - Teaser & Early Access", sends: 4466, opens: 2464, openRate: 56.1, mobileOpen: 40.1, desktopOpen: 59.9, clicks: 169, clickRate: 3.8, bounces: 73, bounceRate: 1.6, unsubs: 5, unsubRate: 0.1 },
  { date: '2026-06-08 10:00', name: "FY26 CS13 Follow-Up #3 Sunday", sends: 527, opens: 297, openRate: 57.7, mobileOpen: 36.5, desktopOpen: 63.5, clicks: 40, clickRate: 7.8, bounces: 12, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-07 10:00', name: "FY26 CS13 Follow-Up #2 Saturday", sends: 450, opens: 267, openRate: 60.5, mobileOpen: 43.4, desktopOpen: 56.6, clicks: 29, clickRate: 6.6, bounces: 9, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-06 10:00', name: "FY26 CS13 Follow-Up #1 Friday", sends: 416, opens: 250, openRate: 60.8, mobileOpen: 43.3, desktopOpen: 56.7, clicks: 24, clickRate: 5.8, bounces: 5, bounceRate: 1.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-05 15:00', name: "FY26 6/3 - Mobile Music Box Email", sends: 57, opens: 29, openRate: 53.7, mobileOpen: 30.8, desktopOpen: 69.2, clicks: 6, clickRate: 11.1, bounces: 3, bounceRate: 5.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-05 14:00', name: "FY26 CS13 KBYG - SUNDAY", sends: 556, opens: 385, openRate: 70.6, mobileOpen: 51.7, desktopOpen: 48.3, clicks: 121, clickRate: 22.2, bounces: 11, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-05 10:00', name: "FY26 On Stage 4 Follow-Up", sends: 42, opens: 27, openRate: 65.9, mobileOpen: 14.3, desktopOpen: 85.7, clicks: 1, clickRate: 2.4, bounces: 1, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-04 18:00', name: "FY26 CS13 KBYG - SATURDAY", sends: 477, opens: 317, openRate: 68, mobileOpen: 57.9, desktopOpen: 42.1, clicks: 98, clickRate: 21, bounces: 11, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-04 15:00', name: "FY26 New Subscriber Acquisition #4", sends: 2639, opens: 1150, openRate: 44.6, mobileOpen: 49.2, desktopOpen: 50.8, clicks: 40, clickRate: 1.6, bounces: 60, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-03 18:00', name: "FY26 CS13 KBYG - FRIDAY", sends: 449, opens: 338, openRate: 75.8, mobileOpen: 53.2, desktopOpen: 46.8, clicks: 102, clickRate: 22.9, bounces: 3, bounceRate: 0.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-03 16:00', name: "FY26 6/2 CS13 Promo #2", sends: 1058, opens: 528, openRate: 51.5, mobileOpen: 57.1, desktopOpen: 42.9, clicks: 30, clickRate: 2.9, bounces: 33, bounceRate: 3.1, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-06-02 18:00', name: "FY26 On Stage 4 KBYG - THURSDAY", sends: 37, opens: 29, openRate: 78.4, mobileOpen: 40, desktopOpen: 60, clicks: 8, clickRate: 21.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-01 11:50', name: "FY26 Contributors Concert KBYG", sends: 227, opens: 191, openRate: 84.1, mobileOpen: 39.1, desktopOpen: 60.9, clicks: 101, clickRate: 44.5, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-06-01 10:00', name: "FY26 CS12 Follow-Up #3 Sunday", sends: 385, opens: 219, openRate: 58.6, mobileOpen: 37.8, desktopOpen: 62.2, clicks: 20, clickRate: 5.3, bounces: 11, bounceRate: 2.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-31 10:00', name: "FY26 CS12 Follow-Up #2 Saturday", sends: 330, opens: 193, openRate: 60.1, mobileOpen: 31.2, desktopOpen: 68.8, clicks: 18, clickRate: 5.6, bounces: 9, bounceRate: 2.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-30 10:00', name: "FY26 CS12 Follow-Up #1 Friday", sends: 355, opens: 215, openRate: 61.3, mobileOpen: 37.7, desktopOpen: 62.3, clicks: 17, clickRate: 4.8, bounces: 4, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-29 14:00', name: "FY26 CS12 KBYG - SUNDAY", sends: 405, opens: 264, openRate: 66.8, mobileOpen: 40.1, desktopOpen: 59.9, clicks: 80, clickRate: 20.3, bounces: 10, bounceRate: 2.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-29 10:00', name: "FY26 5/27 - Mobile Music Box Email", sends: 44, opens: 25, openRate: 58.1, mobileOpen: 38.5, desktopOpen: 61.5, clicks: 4, clickRate: 9.3, bounces: 1, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-29 10:00', name: "FY26 On Stage 3 Follow-Up", sends: 53, opens: 34, openRate: 66.7, mobileOpen: 26.3, desktopOpen: 73.7, clicks: 4, clickRate: 7.8, bounces: 2, bounceRate: 3.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-28 18:00', name: "FY26 CS12 KBYG - SATURDAY", sends: 354, opens: 224, openRate: 64.6, mobileOpen: 61.8, desktopOpen: 38.2, clicks: 78, clickRate: 22.5, bounces: 7, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-28 15:58', name: "FY26 NEW Business Alliance Showhouse Invite", sends: 2, opens: 2, openRate: 100, mobileOpen: 0, desktopOpen: 100, clicks: 1, clickRate: 50, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-27 18:00', name: "FY26 CS12 KBYG - FRIDAY", sends: 388, opens: 300, openRate: 77.9, mobileOpen: 47.3, desktopOpen: 52.7, clicks: 91, clickRate: 23.6, bounces: 3, bounceRate: 0.8, unsubs: 1, unsubRate: 0.3 },
  { date: '2026-05-26 19:00', name: "FY26 On Stage 3 KBYG - THURSDAY", sends: 48, opens: 33, openRate: 71.7, mobileOpen: 80, desktopOpen: 20, clicks: 16, clickRate: 34.8, bounces: 2, bounceRate: 4.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-26 16:30', name: "FY26 CATS Follow-Up (reserved tickets only)", sends: 45, opens: 37, openRate: 84.1, mobileOpen: 53.3, desktopOpen: 46.7, clicks: 3, clickRate: 6.8, bounces: 1, bounceRate: 2.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-23 10:00', name: "FY26 Ben Rector Follow-Up #2 Friday", sends: 544, opens: 277, openRate: 51.9, mobileOpen: 53.8, desktopOpen: 46.2, clicks: 10, clickRate: 1.9, bounces: 10, bounceRate: 1.8, unsubs: 8, unsubRate: 1.5 },
  { date: '2026-05-22 17:00', name: "FY26 5/22 - CATS KBYG (reserved tickets)", sends: 37, opens: 32, openRate: 86.5, mobileOpen: 54.5, desktopOpen: 45.5, clicks: 11, clickRate: 29.7, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-22 15:00', name: "FY26 5/22 - Mobile Music Box Email", sends: 107, opens: 67, openRate: 64.4, mobileOpen: 50, desktopOpen: 50, clicks: 17, clickRate: 16.3, bounces: 3, bounceRate: 2.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-22 10:15', name: "FY26 Chairman's Dinner KBYG", sends: 54, opens: 48, openRate: 90.6, mobileOpen: 58.3, desktopOpen: 41.7, clicks: 1, clickRate: 1.9, bounces: 1, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-22 10:00', name: "FY26 Ben Rector Follow-Up #1 Thursday", sends: 466, opens: 218, openRate: 47.9, mobileOpen: 59.3, desktopOpen: 40.7, clicks: 10, clickRate: 2.2, bounces: 11, bounceRate: 2.4, unsubs: 2, unsubRate: 0.4 },
  { date: '2026-05-21 16:00', name: "FY26 New Subscriber Acquisition #3", sends: 2640, opens: 1456, openRate: 56.5, mobileOpen: 60.8, desktopOpen: 39.2, clicks: 66, clickRate: 2.6, bounces: 61, bounceRate: 2.3, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-05-21 10:04', name: "FY26 CATS VIP KBYG - NO PARKING", sends: 7, opens: 5, openRate: 71.4, mobileOpen: 55.6, desktopOpen: 44.4, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-21 10:02', name: "FY26 CATS VIP KBYG - 1 Parking Pass", sends: 41, opens: 39, openRate: 95.1, mobileOpen: 57.7, desktopOpen: 42.3, clicks: 3, clickRate: 7.3, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-20 20:00', name: "FY26 Ben Rector KBYG - FRIDAY 5/22", sends: 495, opens: 345, openRate: 70.4, mobileOpen: 81.4, desktopOpen: 18.6, clicks: 197, clickRate: 40.2, bounces: 5, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-19 20:00', name: "FY26 Ben Rector KBYG - THURSDAY 5/21", sends: 400, opens: 278, openRate: 70.7, mobileOpen: 79.6, desktopOpen: 20.4, clicks: 148, clickRate: 37.7, bounces: 7, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-19 16:00', name: "FY26 5/19 - CATS Email 2", sends: 109021, opens: 37902, openRate: 36.7, mobileOpen: 37.1, desktopOpen: 62.9, clicks: 766, clickRate: 0.7, bounces: 5831, bounceRate: 5.3, unsubs: 70, unsubRate: 0.1 },
  { date: '2026-05-18 13:30', name: "FY26 Subscriber Courtesy Week", sends: 1804, opens: 1216, openRate: 68, mobileOpen: 28.1, desktopOpen: 71.9, clicks: 111, clickRate: 6.2, bounces: 15, bounceRate: 0.8, unsubs: 3, unsubRate: 0.2 },
  { date: '2026-05-18 10:00', name: "FY26 Dolly Parton Follow-Up #3 Sunday", sends: 433, opens: 224, openRate: 52.6, mobileOpen: 13.8, desktopOpen: 86.2, clicks: 9, clickRate: 2.1, bounces: 7, bounceRate: 1.6, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-05-17 10:00', name: "FY26 Dolly Parton Follow-Up #2 Saturday", sends: 380, opens: 211, openRate: 56, mobileOpen: 48.6, desktopOpen: 51.4, clicks: 15, clickRate: 4, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-16 10:00', name: "FY26 Dolly Parton Follow-Up #1 Friday", sends: 411, opens: 213, openRate: 52.9, mobileOpen: 26.7, desktopOpen: 73.3, clicks: 11, clickRate: 2.7, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-15 18:00', name: "FY26 Dolly Parton KBYG - SUNDAY 5/17", sends: 381, opens: 244, openRate: 65.1, mobileOpen: 67.5, desktopOpen: 32.5, clicks: 99, clickRate: 26.4, bounces: 6, bounceRate: 1.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-15 15:00', name: "FY26 Match Appeal 5.15", sends: 18801, opens: 7224, openRate: 39.5, mobileOpen: 34.5, desktopOpen: 65.5, clicks: 52, clickRate: 0.3, bounces: 493, bounceRate: 2.6, unsubs: 11, unsubRate: 0.1 },
  { date: '2026-05-15 14:30', name: "FY26 EU Tour Sale - General Audience", sends: 29780, opens: 11229, openRate: 38.7, mobileOpen: 39, desktopOpen: 61, clicks: 162, clickRate: 0.6, bounces: 795, bounceRate: 2.7, unsubs: 29, unsubRate: 0.1 },
  { date: '2026-05-15 14:00', name: "FY26 5/15 - Mobile Music Box Email", sends: 38, opens: 27, openRate: 73, mobileOpen: 28.1, desktopOpen: 71.9, clicks: 11, clickRate: 29.7, bounces: 1, bounceRate: 2.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-14 18:00', name: "FY26 Dolly Parton KBYG - SATURDAY 5/16", sends: 349, opens: 237, openRate: 68.1, mobileOpen: 67.4, desktopOpen: 32.6, clicks: 71, clickRate: 20.4, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-13 18:00', name: "FY26 Dolly Parton KBYG - FRIDAY 5/15", sends: 388, opens: 264, openRate: 68.8, mobileOpen: 59.8, desktopOpen: 40.2, clicks: 81, clickRate: 21.1, bounces: 4, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-13 09:15', name: "FY26 Contributors' Concert Invite - 3rd Wave", sends: 1830, opens: 1168, openRate: 65.2, mobileOpen: 40.4, desktopOpen: 59.6, clicks: 391, clickRate: 21.8, bounces: 38, bounceRate: 2.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-12 16:00', name: "FY26 EU Tour Pre-Sale #2 - Subscribers & Donors", sends: 2887, opens: 1621, openRate: 57.3, mobileOpen: 36.4, desktopOpen: 63.6, clicks: 132, clickRate: 4.7, bounces: 59, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-11 10:30', name: "FY26 Contributors' Concert Invite - 2nd Wave", sends: 117, opens: 93, openRate: 79.5, mobileOpen: 35.5, desktopOpen: 64.5, clicks: 38, clickRate: 32.5, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-11 10:00', name: "FY26 CS11 Follow-Up #3 Sunday", sends: 420, opens: 242, openRate: 58.5, mobileOpen: 31.7, desktopOpen: 68.3, clicks: 20, clickRate: 4.8, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-10 10:00', name: "FY26 CS11 Follow-Up #2 Saturday", sends: 407, opens: 237, openRate: 59.4, mobileOpen: 33.3, desktopOpen: 66.7, clicks: 14, clickRate: 3.5, bounces: 8, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-09 10:00', name: "FY26 CS11 Follow-Up #1 Friday", sends: 340, opens: 197, openRate: 59, mobileOpen: 26, desktopOpen: 74, clicks: 11, clickRate: 3.3, bounces: 6, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 14:00', name: "FY26 CS11 KBYG - SUNDAY", sends: 415, opens: 280, openRate: 68.5, mobileOpen: 51.8, desktopOpen: 48.2, clicks: 90, clickRate: 22, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 11:30', name: "FY26 5/9 Petite Performances 11:30 Reminder", sends: 41, opens: 31, openRate: 79.5, mobileOpen: 40, desktopOpen: 60, clicks: 4, clickRate: 10.3, bounces: 2, bounceRate: 4.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 11:13', name: "FY26 CATS VIP Invite - Auxiliaries", sends: 45, opens: 30, openRate: 66.7, mobileOpen: 61.5, desktopOpen: 38.5, clicks: 4, clickRate: 8.9, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 10:30', name: "FY26 5/9 Petite Performances 10:30 Reminder", sends: 56, opens: 42, openRate: 77.8, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 6, clickRate: 11.1, bounces: 2, bounceRate: 3.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 09:30', name: "FY26 5/9 Petite Performances 9:30 Reminder", sends: 50, opens: 37, openRate: 75.5, mobileOpen: 57.1, desktopOpen: 42.9, clicks: 3, clickRate: 6.1, bounces: 1, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-07 20:00', name: "FY26 CS11 KBYG - SATURDAY", sends: 385, opens: 247, openRate: 65, mobileOpen: 56.8, desktopOpen: 43.2, clicks: 78, clickRate: 20.5, bounces: 5, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-07 19:00', name: "FY26 New Subscriber Acquisition #2", sends: 2646, opens: 1188, openRate: 45.9, mobileOpen: 49.1, desktopOpen: 50.9, clicks: 28, clickRate: 1.1, bounces: 56, bounceRate: 2.1, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-05-07 16:23', name: "FY26 EU Tour Pre-Sale #1 - Symphony Society", sends: 337, opens: 242, openRate: 72.2, mobileOpen: 28.9, desktopOpen: 71.1, clicks: 32, clickRate: 9.6, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-07 11:10', name: "FY26 CATS VIP Invite Follow Up - Board & $30k", sends: 35, opens: 25, openRate: 71.4, mobileOpen: 35.7, desktopOpen: 64.3, clicks: 3, clickRate: 8.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-06 20:00', name: "FY26 CS11 KBYG - FRIDAY", sends: 276, opens: 187, openRate: 68.5, mobileOpen: 45.2, desktopOpen: 54.8, clicks: 60, clickRate: 22, bounces: 3, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-06 10:02', name: "FY26 Contributors' Concert Invite - 1st Wave", sends: 41, opens: 30, openRate: 73.2, mobileOpen: 34.8, desktopOpen: 65.2, clicks: 10, clickRate: 24.4, bounces: 0, bounceRate: 0, unsubs: 1, unsubRate: 2.4 },
  { date: '2026-05-06 09:20', name: "FY26 CATS VIP Invite Follow Up - Fanfare, Overture, Sempre, Prelude, Baton", sends: 544, opens: 343, openRate: 63.8, mobileOpen: 40.9, desktopOpen: 59.1, clicks: 12, clickRate: 2.2, bounces: 6, bounceRate: 1.1, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-05-05 16:30', name: "FY26 5/5 Weekly Concert Promo CS13", sends: 1095, opens: 566, openRate: 52.9, mobileOpen: 30.5, desktopOpen: 69.5, clicks: 23, clickRate: 2.2, bounces: 26, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-05 15:36', name: "FY26 5/5 - Mobile Music Box Email 2", sends: 49, opens: 36, openRate: 75, mobileOpen: 50, desktopOpen: 50, clicks: 4, clickRate: 8.3, bounces: 1, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-04 12:12', name: "FY26 Business Alliance Showhouse Invite", sends: 2, opens: 2, openRate: 100, mobileOpen: 0, desktopOpen: 100, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-01 14:49', name: "FY26 5/1 - Mobile Music Box Email 1", sends: 68, opens: 44, openRate: 65.7, mobileOpen: 50, desktopOpen: 50, clicks: 12, clickRate: 17.9, bounces: 1, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-30 18:00', name: "FY26 4/30 - CATS Email 1", sends: 109140, opens: 37907, openRate: 36.4, mobileOpen: 36.7, desktopOpen: 63.3, clicks: 578, clickRate: 0.6, bounces: 5106, bounceRate: 4.7, unsubs: 75, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: "FY26 4/28 Weekly Concert Update Ben Rector -- CE CONTROL GROUP", sends: 1369, opens: 640, openRate: 47.7, mobileOpen: 26.3, desktopOpen: 73.7, clicks: 12, clickRate: 0.9, bounces: 26, bounceRate: 1.9, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: "FY26 4/28 Weekly Concert Promo CS12 - CE COMBO", sends: 22839, opens: 10348, openRate: 46.3, mobileOpen: 47, desktopOpen: 53, clicks: 141, clickRate: 0.6, bounces: 495, bounceRate: 2.2, unsubs: 28, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: "FY26 4/28 Weekly Concert Promo CS12 - CA COMBO", sends: 7010, opens: 3186, openRate: 46.7, mobileOpen: 48.3, desktopOpen: 51.7, clicks: 53, clickRate: 0.8, bounces: 193, bounceRate: 2.8, unsubs: 5, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: "FY26 4/28 Weekly Concert Promo CS12 - CA CONTROL", sends: 416, opens: 199, openRate: 48.8, mobileOpen: 26.8, desktopOpen: 73.2, clicks: 8, clickRate: 2, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-24 12:09', name: "FY26 4/22 - Dolly, CS11, CS12 Promo - BOGO", sends: 1086, opens: 575, openRate: 53.6, mobileOpen: 31.5, desktopOpen: 68.5, clicks: 20, clickRate: 1.9, bounces: 14, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-23 16:00', name: "FY26 New Subscriber 4/23", sends: 2787, opens: 1312, openRate: 48, mobileOpen: 49.2, desktopOpen: 50.8, clicks: 30, clickRate: 1.1, bounces: 54, bounceRate: 1.9, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-04-22 11:42', name: "FY26 CATS VIP Invite - Fanfare, Overture, Sempre, Prelude, Baton", sends: 554, opens: 381, openRate: 69.5, mobileOpen: 43.9, desktopOpen: 56.1, clicks: 43, clickRate: 7.8, bounces: 6, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-22 11:41', name: "FY26 CATS VIP Invite - Crescendo & Bravura", sends: 122, opens: 97, openRate: 79.5, mobileOpen: 33.7, desktopOpen: 66.3, clicks: 21, clickRate: 17.2, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-21 16:00', name: "FY26 4/21 Weekly Concert Update Steve Hackman -- CE CONTROL GROUP", sends: 1366, opens: 657, openRate: 49, mobileOpen: 37.9, desktopOpen: 62.1, clicks: 13, clickRate: 1, bounces: 25, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-21 16:00', name: "FY26 4/21 Weekly Concert Promo CS11 - CA CONTROL", sends: 413, opens: 197, openRate: 48.9, mobileOpen: 24, desktopOpen: 76, clicks: 4, clickRate: 1, bounces: 10, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-21 16:00', name: "FY26 4/21 Weekly Concert Update Steve Hackman -- CE COMBO", sends: 22868, opens: 10859, openRate: 48.5, mobileOpen: 53.7, desktopOpen: 46.3, clicks: 346, clickRate: 1.5, bounces: 491, bounceRate: 2.1, unsubs: 29, unsubRate: 0.1 },
  { date: '2026-04-21 16:00', name: "FY26 4/21 Weekly Concert Update Steve Hackman -- CA COMBO", sends: 7014, opens: 3295, openRate: 48.3, mobileOpen: 48.5, desktopOpen: 51.5, clicks: 77, clickRate: 1.1, bounces: 186, bounceRate: 2.7, unsubs: 7, unsubRate: 0.1 },
  { date: '2026-04-17 14:00', name: "FY26 CS10 KBYG - SUNDAY", sends: 369, opens: 243, openRate: 66.4, mobileOpen: 37.1, desktopOpen: 62.9, clicks: 61, clickRate: 16.7, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-17 11:00', name: "FY26 Match Appeal 4.17", sends: 18843, opens: 7327, openRate: 39.9, mobileOpen: 35.7, desktopOpen: 64.3, clicks: 76, clickRate: 0.4, bounces: 460, bounceRate: 2.4, unsubs: 10, unsubRate: 0.1 },
  { date: '2026-04-16 20:00', name: "FY26 CS10 KBYG - SATURDAY", sends: 329, opens: 213, openRate: 66.4, mobileOpen: 40, desktopOpen: 60, clicks: 51, clickRate: 15.9, bounces: 8, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-16 16:16', name: "FY26 Film Subscription Announcement 4/16", sends: 2788, opens: 1374, openRate: 50.3, mobileOpen: 49.5, desktopOpen: 50.5, clicks: 83, clickRate: 3, bounces: 55, bounceRate: 2, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-15 20:00', name: "FY26 CS10 KBYG - FRIDAY", sends: 329, opens: 236, openRate: 72, mobileOpen: 31.6, desktopOpen: 68.4, clicks: 54, clickRate: 16.5, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-14 16:00', name: "FY26 4/14 Weekly Concert Update Dolly Parton Threads -- CE CONTROL GROUP", sends: 1371, opens: 624, openRate: 46.3, mobileOpen: 41.2, desktopOpen: 58.8, clicks: 12, clickRate: 0.9, bounces: 23, bounceRate: 1.7, unsubs: 4, unsubRate: 0.3 },
  { date: '2026-04-14 16:00', name: "FY26 4/14 Weekly Concert CS14 - Classical Aficionado COMBO", sends: 7022, opens: 3360, openRate: 49.1, mobileOpen: 40.5, desktopOpen: 59.5, clicks: 96, clickRate: 1.4, bounces: 184, bounceRate: 2.6, unsubs: 8, unsubRate: 0.1 },
  { date: '2026-04-14 16:00', name: "FY26 4/14 Weekly Concert CS14 - Curious Explorer COMBO", sends: 22903, opens: 10437, openRate: 46.6, mobileOpen: 48.1, desktopOpen: 51.9, clicks: 170, clickRate: 0.8, bounces: 495, bounceRate: 2.2, unsubs: 30, unsubRate: 0.1 },
  { date: '2026-04-14 16:00', name: "FY26 4/14 Weekly Concert Promo CS14 - CA CONTROL", sends: 413, opens: 198, openRate: 48.9, mobileOpen: 44, desktopOpen: 56, clicks: 3, clickRate: 0.7, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-14 15:12', name: "FY26 CATS VIP Invite - Board & $30k", sends: 40, opens: 31, openRate: 77.5, mobileOpen: 70.5, desktopOpen: 29.5, clicks: 9, clickRate: 22.5, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-10 14:59', name: "FY26 CS9 KBYG - CORRECTION EMAIL", sends: 1060, opens: 716, openRate: 68.3, mobileOpen: 45.2, desktopOpen: 54.8, clicks: 10, clickRate: 1, bounces: 11, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-10 14:00', name: "FY26 CS9 KBYG - SUNDAY", sends: 402, opens: 272, openRate: 68.5, mobileOpen: 47.1, desktopOpen: 52.9, clicks: 80, clickRate: 20.2, bounces: 5, bounceRate: 1.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-09 20:00', name: "FY26 CS9 KBYG - SATURDAY", sends: 374, opens: 255, openRate: 69.1, mobileOpen: 60.2, desktopOpen: 39.8, clicks: 76, clickRate: 20.6, bounces: 5, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-08 20:00', name: "FY26 CS9 KBYG - FRIDAY", sends: 309, opens: 219, openRate: 71.3, mobileOpen: 48.8, desktopOpen: 51.2, clicks: 72, clickRate: 23.5, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-07 18:00', name: "FY26 4/7 Weekly Concert CS13 - Curious Explorer COMBO", sends: 22966, opens: 10461, openRate: 46.5, mobileOpen: 46.3, desktopOpen: 53.7, clicks: 125, clickRate: 0.6, bounces: 482, bounceRate: 2.1, unsubs: 31, unsubRate: 0.1 },
  { date: '2026-04-07 18:00', name: "FY26 4/7 Weekly Concert Update PP: Goldilocks -- CE CONTROL GROUP", sends: 1375, opens: 648, openRate: 48, mobileOpen: 43.1, desktopOpen: 56.9, clicks: 15, clickRate: 1.1, bounces: 24, bounceRate: 1.7, unsubs: 3, unsubRate: 0.2 },
  { date: '2026-04-07 18:00', name: "FY26 4/7 Weekly Concert Promo CS13 - CA CONTROL", sends: 415, opens: 197, openRate: 48.4, mobileOpen: 33.3, desktopOpen: 66.7, clicks: 3, clickRate: 0.7, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-07 18:00', name: "FY26 4/7 Weekly Concert CS13 - Classical Aficionado COMBO", sends: 7039, opens: 3304, openRate: 48.2, mobileOpen: 44.4, desktopOpen: 55.6, clicks: 81, clickRate: 1.2, bounces: 181, bounceRate: 2.6, unsubs: 8, unsubRate: 0.1 },
  { date: '2026-04-03 09:22', name: "FY26 4/2 Catch Up Ben Rector -- Curious Explorer", sends: 3945, opens: 1839, openRate: 47, mobileOpen: 43.5, desktopOpen: 56.5, clicks: 37, clickRate: 0.9, bounces: 32, bounceRate: 0.8, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-04-03 09:00', name: "FY26 4/2 Catch Up Ben Rector -- Classical Aficionado", sends: 4092, opens: 1680, openRate: 41.7, mobileOpen: 36.4, desktopOpen: 63.6, clicks: 30, clickRate: 0.7, bounces: 66, bounceRate: 1.6, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-04-02 19:00', name: "FY26 NMV - General Interest Catch Up Send 4/2", sends: 29944, opens: 12551, openRate: 43, mobileOpen: 48.4, desktopOpen: 51.6, clicks: 403, clickRate: 1.4, bounces: 746, bounceRate: 2.5, unsubs: 45, unsubRate: 0.2 },
  { date: '2026-04-02 11:59', name: "FY26 NMV - Donor Follow Up 4/2", sends: 1409, opens: 825, openRate: 59.3, mobileOpen: 33.1, desktopOpen: 66.9, clicks: 49, clickRate: 3.5, bounces: 18, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-31 16:00', name: "FY26 3/31 Weekly Concert Update Ben Rector -- Curious Explorer CONTROL GROUP", sends: 229, opens: 120, openRate: 53.3, mobileOpen: 14.3, desktopOpen: 85.7, clicks: 3, clickRate: 1.3, bounces: 4, bounceRate: 1.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-31 16:00', name: "FY26 3/31 Weekly Concert Update Ben Rector -- Curious Explorer MAIN AUDIENCE", sends: 478, opens: 257, openRate: 54.6, mobileOpen: 34.6, desktopOpen: 65.4, clicks: 6, clickRate: 1.3, bounces: 7, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-31 16:00', name: "FY26 3/31 Weekly Concert Promo CS12 - Classical Aficionado CONTROL", sends: 265, opens: 133, openRate: 51.4, mobileOpen: 64.7, desktopOpen: 35.3, clicks: 3, clickRate: 1.2, bounces: 6, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-30 13:22', name: "EJT Donor Message on NMV TRUE", sends: 818, opens: 572, openRate: 71, mobileOpen: 33.3, desktopOpen: 66.7, clicks: 13, clickRate: 1.6, bounces: 12, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-30 08:33', name: "FY26 NMV External Announcement 3/30", sends: 30475, opens: 13309, openRate: 45.5, mobileOpen: 46.3, desktopOpen: 53.7, clicks: 799, clickRate: 2.7, bounces: 1202, bounceRate: 3.9, unsubs: 32, unsubRate: 0.1 },
  { date: '2026-03-27 14:15', name: "FY26 Match Appeal 3.27", sends: 18974, opens: 7421, openRate: 40, mobileOpen: 34.7, desktopOpen: 65.3, clicks: 74, clickRate: 0.4, bounces: 443, bounceRate: 2.3, unsubs: 24, unsubRate: 0.1 },
  { date: '2026-03-27 14:00', name: "FY26 Billy Joel & Elton John KYBG - SUNDAY 3/29", sends: 473, opens: 324, openRate: 69.8, mobileOpen: 61.9, desktopOpen: 38.1, clicks: 137, clickRate: 29.5, bounces: 9, bounceRate: 1.9, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-03-27 09:00', name: "FY26 Subscriber Renewal: Last Chance 3/27 - Pops and Family", sends: 310, opens: 178, openRate: 57.6, mobileOpen: 38, desktopOpen: 62, clicks: 16, clickRate: 5.2, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-27 09:00', name: "FY26 Subscriber Renewal: Last Chance 3/27 - Classical", sends: 471, opens: 273, openRate: 58.7, mobileOpen: 27.6, desktopOpen: 72.4, clicks: 37, clickRate: 8, bounces: 6, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-26 20:00', name: "FY26 Billy Joel & Elton John KYBG - SATURDAY 3/28", sends: 475, opens: 347, openRate: 73.2, mobileOpen: 73.4, desktopOpen: 26.6, clicks: 134, clickRate: 28.3, bounces: 1, bounceRate: 0.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-25 20:00', name: "FY26 Billy Joel & Elton John KYBG - FRIDAY 3/27", sends: 491, opens: 335, openRate: 68.8, mobileOpen: 60.7, desktopOpen: 39.3, clicks: 117, clickRate: 24, bounces: 4, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-24 19:00', name: "FY26 Final Symphony KYBG - THURSDAY 3/26", sends: 308, opens: 175, openRate: 57, mobileOpen: 85.2, desktopOpen: 14.8, clicks: 85, clickRate: 27.7, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-24 16:00', name: "FY26 3/24 Weekly Concert Promo On Stage Gil Shaham - Classical Aficionado", sends: 4869, opens: 2057, openRate: 42.9, mobileOpen: 41.6, desktopOpen: 58.4, clicks: 45, clickRate: 0.9, bounces: 76, bounceRate: 1.6, unsubs: 4, unsubRate: 0.1 },
  { date: '2026-03-24 16:00', name: "FY26 3/24 Weekly Concert Update Steve Hackman -- Curious Explorer", sends: 4643, opens: 2417, openRate: 52.5, mobileOpen: 60.4, desktopOpen: 39.6, clicks: 246, clickRate: 5.3, bounces: 39, bounceRate: 0.8, unsubs: 3, unsubRate: 0.1 },
  { date: '2026-03-23 19:00', name: "FY26 Final Symphony KYBG - WEDNESDAY 3/25", sends: 351, opens: 229, openRate: 65.2, mobileOpen: 80.5, desktopOpen: 19.5, clicks: 110, clickRate: 31.3, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-19 16:00', name: "FY26 Subscriber Renewal: Count Down Timer 3/19 - Classical", sends: 683, opens: 428, openRate: 63.4, mobileOpen: 25.5, desktopOpen: 74.5, clicks: 64, clickRate: 9.5, bounces: 8, bounceRate: 1.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-19 16:00', name: "FY26 Subscriber Renewal: Count Down Timer 3/19 - Pops and Family", sends: 399, opens: 241, openRate: 60.7, mobileOpen: 31.1, desktopOpen: 68.9, clicks: 32, clickRate: 8.1, bounces: 2, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-17 18:00', name: "FY26 3/17 Weekly Concert Promo CS11 - Classical Aficionado", sends: 9805, opens: 4051, openRate: 42.3, mobileOpen: 41.2, desktopOpen: 58.8, clicks: 120, clickRate: 1.3, bounces: 238, bounceRate: 2.4, unsubs: 9, unsubRate: 0.1 },
  { date: '2026-03-17 18:00', name: "FY26 3/17 Weekly Concert Update Dolly Parton's Threads -- Curious Explorer", sends: 7348, opens: 3177, openRate: 43.7, mobileOpen: 42.4, desktopOpen: 57.6, clicks: 80, clickRate: 1.1, bounces: 74, bounceRate: 1, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-03-17 16:51', name: "FY26 Chairman's Invite - Reminder & Update", sends: 61, opens: 45, openRate: 73.8, mobileOpen: 37.9, desktopOpen: 62.1, clicks: 10, clickRate: 16.4, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 14:00', name: "FY26 CS8 KYBG - SUNDAY 3/15", sends: 365, opens: 265, openRate: 73.2, mobileOpen: 46.9, desktopOpen: 53.1, clicks: 81, clickRate: 22.4, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 11:30', name: "FY26 3/14 Petite Performances 11:30 Reminder", sends: 46, opens: 37, openRate: 80.4, mobileOpen: 81.8, desktopOpen: 18.2, clicks: 4, clickRate: 8.7, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 10:30', name: "FY26 3/14 Petite Performances 10:30 Reminder", sends: 53, opens: 48, openRate: 92.3, mobileOpen: 80.6, desktopOpen: 19.4, clicks: 12, clickRate: 23.1, bounces: 1, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 09:30', name: "FY26 3/14 Petite Performances 9:30 Reminder", sends: 48, opens: 41, openRate: 85.4, mobileOpen: 66.7, desktopOpen: 33.3, clicks: 8, clickRate: 16.7, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-12 20:00', name: "FY26 CS8 KYBG - SATURDAY 3/14", sends: 296, opens: 204, openRate: 69.6, mobileOpen: 45.6, desktopOpen: 54.4, clicks: 56, clickRate: 19.1, bounces: 3, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-12 18:30', name: "FY26 Subscriber Renewal: Don't Miss Out 3/12 - Pops and Family", sends: 489, opens: 294, openRate: 60.4, mobileOpen: 27.3, desktopOpen: 72.7, clicks: 15, clickRate: 3.1, bounces: 2, bounceRate: 0.4, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-03-12 18:30', name: "FY26 Subscriber Renewal: Don't Miss Out 3/12 - Classical", sends: 817, opens: 519, openRate: 64.6, mobileOpen: 44.4, desktopOpen: 55.6, clicks: 40, clickRate: 5, bounces: 13, bounceRate: 1.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-12 14:07', name: "FY26 CS8 KYBG - FRIDAY CORRECT", sends: 314, opens: 244, openRate: 78.2, mobileOpen: 52.7, desktopOpen: 47.3, clicks: 57, clickRate: 18.3, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-11 20:00', name: "FY26 CS8 KYBG - FRIDAY", sends: 314, opens: 167, openRate: 53.5, mobileOpen: 41.2, desktopOpen: 58.8, clicks: 22, clickRate: 7.1, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-10 17:30', name: "FY26 3/10 Weekly Concert Promo CS10 - Classical Aficionado", sends: 9658, opens: 4342, openRate: 46.1, mobileOpen: 43, desktopOpen: 57, clicks: 111, clickRate: 1.2, bounces: 233, bounceRate: 2.4, unsubs: 5, unsubRate: 0.1 },
  { date: '2026-03-10 17:30', name: "FY26 3/10 Weekly Concert Update Final Symphony -- Curious Explorer", sends: 7339, opens: 3575, openRate: 49.2, mobileOpen: 43, desktopOpen: 57, clicks: 63, clickRate: 0.9, bounces: 72, bounceRate: 1, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-03-09 11:59', name: "FY26 Campaign Events Invite Reminder - MARNY", sends: 38, opens: 28, openRate: 77.8, mobileOpen: 7.5, desktopOpen: 92.5, clicks: 5, clickRate: 13.9, bounces: 2, bounceRate: 5.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-09 11:58', name: "FY26 Campaign Events Invite Reminder - JEFF", sends: 16, opens: 14, openRate: 93.3, mobileOpen: 38.1, desktopOpen: 61.9, clicks: 2, clickRate: 13.3, bounces: 1, bounceRate: 6.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-09 11:56', name: "FY26 Campaign Events Invite Reminder - BEBE", sends: 14, opens: 12, openRate: 92.3, mobileOpen: 21.1, desktopOpen: 78.9, clicks: 0, clickRate: 0, bounces: 1, bounceRate: 7.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-05 18:00', name: "FY26 Subscriber Renewal 3/5 - Pops and Family", sends: 684, opens: 397, openRate: 58.3, mobileOpen: 41.3, desktopOpen: 58.7, clicks: 15, clickRate: 2.2, bounces: 3, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-05 18:00', name: "FY26 Subscriber Renewal 3/5 - Classical", sends: 1144, opens: 700, openRate: 61.8, mobileOpen: 30.8, desktopOpen: 69.2, clicks: 25, clickRate: 2.2, bounces: 11, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-03 18:00', name: "FY26 3/3 Weekly Concert Update -- Curious Explorer", sends: 7329, opens: 3652, openRate: 50.3, mobileOpen: 46.7, desktopOpen: 53.3, clicks: 57, clickRate: 0.8, bounces: 67, bounceRate: 0.9, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-03-03 18:00', name: "FY26 3/3 Weekly Concert Promo CS8 - Classical Aficionado", sends: 9657, opens: 4543, openRate: 48.2, mobileOpen: 44.3, desktopOpen: 55.7, clicks: 148, clickRate: 1.6, bounces: 230, bounceRate: 2.4, unsubs: 3, unsubRate: 0.1 },
  { date: '2026-02-27 14:01', name: "FY26 Philharmonia Fantastique KYBG", sends: 167, opens: 126, openRate: 75.9, mobileOpen: 45.8, desktopOpen: 54.2, clicks: 31, clickRate: 18.7, bounces: 1, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-26 19:00', name: "FY26 Subscriber Renewal 2/26", sends: 1553, opens: 1010, openRate: 65.6, mobileOpen: 24.1, desktopOpen: 75.9, clicks: 91, clickRate: 5.9, bounces: 13, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-24 13:11', name: "FY26 2/24 Weekly Concert Promo", sends: 97492, opens: 35235, openRate: 37.6, mobileOpen: 29, desktopOpen: 71, clicks: 383, clickRate: 0.4, bounces: 3788, bounceRate: 3.9, unsubs: 38, unsubRate: 0.1 },
  { date: '2026-02-21 14:00', name: "FY26 Harry Potter KYBG - SUNDAY", sends: 328, opens: 230, openRate: 70.8, mobileOpen: 76.2, desktopOpen: 23.8, clicks: 98, clickRate: 30.2, bounces: 3, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-20 19:00', name: "FY26 Harry Potter KYBG - SATURDAY", sends: 380, opens: 253, openRate: 66.9, mobileOpen: 83, desktopOpen: 17, clicks: 104, clickRate: 27.5, bounces: 2, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-19 19:00', name: "FY26 Harry Potter KYBG - FRIDAY", sends: 402, opens: 263, openRate: 66.1, mobileOpen: 86.3, desktopOpen: 13.7, clicks: 105, clickRate: 26.4, bounces: 4, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-19 14:47', name: "FY26 Billy Joel/Elton John Standalone #1", sends: 97591, opens: 35649, openRate: 38, mobileOpen: 39.2, desktopOpen: 60.8, clicks: 984, clickRate: 1, bounces: 3708, bounceRate: 3.8, unsubs: 27, unsubRate: 0.1 },
  { date: '2026-02-18 11:19', name: "FY26 Chairman's Save the Date - BOTH", sends: 19, opens: 15, openRate: 78.9, mobileOpen: 21.4, desktopOpen: 78.6, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-18 11:14', name: "FY26 Chairman's Save the Date - 1 ONLY", sends: 72, opens: 60, openRate: 83.3, mobileOpen: 23.1, desktopOpen: 76.9, clicks: 2, clickRate: 2.8, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-18 10:51', name: "FY26 Harry Potter KYBG - THURSDAY", sends: 428, opens: 258, openRate: 61.1, mobileOpen: 62.4, desktopOpen: 37.6, clicks: 113, clickRate: 26.8, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-17 20:00', name: "FY26 2/17 Weekly Concert Promo", sends: 96853, opens: 36108, openRate: 38.8, mobileOpen: 30.7, desktopOpen: 69.3, clicks: 405, clickRate: 0.4, bounces: 3771, bounceRate: 3.9, unsubs: 39, unsubRate: 0.1 },
  { date: '2026-02-13 14:00', name: "FY26 She's Got Soul KYBG - SUNDAY", sends: 293, opens: 130, openRate: 44.8, mobileOpen: 64.2, desktopOpen: 35.8, clicks: 66, clickRate: 22.8, bounces: 3, bounceRate: 1, unsubs: 1, unsubRate: 0.3 },
  { date: '2026-02-12 19:00', name: "FY26 She's Got Soul KYBG - SATURDAY", sends: 407, opens: 174, openRate: 43, mobileOpen: 81.5, desktopOpen: 18.5, clicks: 83, clickRate: 20.5, bounces: 2, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-12 14:15', name: "FY26/27 Season Announcement Email #2", sends: 96950, opens: 14079, openRate: 15.1, mobileOpen: 36.4, desktopOpen: 63.6, clicks: 1652, clickRate: 1.8, bounces: 3622, bounceRate: 3.7, unsubs: 36, unsubRate: 0.1 },
  { date: '2026-02-12 12:26', name: "FY26 She's Got Soul KYBG - FRIDAY", sends: 394, opens: 190, openRate: 48.7, mobileOpen: 55.5, desktopOpen: 44.5, clicks: 79, clickRate: 20.3, bounces: 4, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-10 19:00', name: "FY26 Chris Thile KYBG - THURSDAY", sends: 523, opens: 287, openRate: 55.5, mobileOpen: 78, desktopOpen: 22, clicks: 179, clickRate: 34.6, bounces: 6, bounceRate: 1.1, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-02-10 10:30', name: "FY26 2/10 Weekly Concert Promo", sends: 96601, opens: 11385, openRate: 12.2, mobileOpen: 26.5, desktopOpen: 73.5, clicks: 316, clickRate: 0.3, bounces: 3588, bounceRate: 3.7, unsubs: 33, unsubRate: 0.1 },
  { date: '2026-02-06 10:00', name: "FY26 CS7 KYBG - SUNDAY", sends: 318, opens: 146, openRate: 46.2, mobileOpen: 29.7, desktopOpen: 70.3, clicks: 62, clickRate: 19.6, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-05 10:00', name: "FY26 CS7 KYBG - SATURDAY", sends: 275, opens: 115, openRate: 42.1, mobileOpen: 39.4, desktopOpen: 60.6, clicks: 54, clickRate: 19.8, bounces: 2, bounceRate: 0.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-05 09:27', name: "FY26 She's Got Soul Standalone #2", sends: 96676, opens: 12170, openRate: 13.1, mobileOpen: 25.4, desktopOpen: 74.6, clicks: 264, clickRate: 0.3, bounces: 3592, bounceRate: 3.7, unsubs: 29, unsubRate: 0.1 },
  { date: '2026-02-05 09:19', name: "FY26 Sempre Brunch KBYG", sends: 35, opens: 23, openRate: 65.7, mobileOpen: 31.8, desktopOpen: 68.2, clicks: 3, clickRate: 8.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-04 16:21', name: "FY26 On Stage 2 KYBG - THURSDAY", sends: 34, opens: 27, openRate: 81.8, mobileOpen: 59.2, desktopOpen: 40.8, clicks: 15, clickRate: 45.5, bounces: 1, bounceRate: 2.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-04 10:00', name: "FY26 CS7 KYBG - FRIDAY", sends: 254, opens: 171, openRate: 67.6, mobileOpen: 46, desktopOpen: 54, clicks: 54, clickRate: 21.3, bounces: 1, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-03 12:14', name: "FY26 2/3 Weekly Concert Promo", sends: 96691, opens: 33359, openRate: 35.8, mobileOpen: 27.5, desktopOpen: 72.5, clicks: 353, clickRate: 0.4, bounces: 3580, bounceRate: 3.7, unsubs: 31, unsubRate: 0.1 },
  { date: '2026-01-30 14:00', name: "FY26 CS6 KYBG - SUNDAY", sends: 444, opens: 310, openRate: 70.8, mobileOpen: 51.6, desktopOpen: 48.4, clicks: 76, clickRate: 17.4, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-29 19:00', name: "FY26 CS6 KYBG - SATURDAY", sends: 418, opens: 274, openRate: 67.3, mobileOpen: 46.7, desktopOpen: 53.3, clicks: 77, clickRate: 18.9, bounces: 11, bounceRate: 2.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-29 13:08', name: "FY26/27 Season Launch Email", sends: 96820, opens: 36064, openRate: 38.7, mobileOpen: 38, desktopOpen: 62, clicks: 1697, clickRate: 1.8, bounces: 3594, bounceRate: 3.7, unsubs: 35, unsubRate: 0.1 },
  { date: '2026-01-29 12:40', name: "FY26 CS6 KYBG - FRIDAY", sends: 302, opens: 221, openRate: 74.2, mobileOpen: 46.9, desktopOpen: 53.1, clicks: 64, clickRate: 21.5, bounces: 4, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-28 16:33', name: "Piano Master Class with Tamara Stefanovich", sends: 2891, opens: 1124, openRate: 42.9, mobileOpen: 17.6, desktopOpen: 82.4, clicks: 52, clickRate: 2, bounces: 274, bounceRate: 9.5, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-01-27 14:03', name: "FY26 1/27 Weekly Concert Promo", sends: 96788, opens: 34822, openRate: 37.4, mobileOpen: 25.5, desktopOpen: 74.5, clicks: 448, clickRate: 0.5, bounces: 3638, bounceRate: 3.8, unsubs: 24, unsubRate: 0.1 },
  { date: '2026-01-26 09:47', name: "FY26 Season Announcement KBYG", sends: 60, opens: 56, openRate: 93.3, mobileOpen: 45.3, desktopOpen: 54.7, clicks: 6, clickRate: 10, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-23 19:00', name: "FY26 Indiana Jones KYBG - SUNDAY", sends: 357, opens: 243, openRate: 69, mobileOpen: 63.1, desktopOpen: 36.9, clicks: 80, clickRate: 22.7, bounces: 5, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-23 11:01', name: "FY26 Philharmonia Fantastique Standalone", sends: 96920, opens: 34564, openRate: 37, mobileOpen: 28.6, desktopOpen: 71.4, clicks: 497, clickRate: 0.5, bounces: 3593, bounceRate: 3.7, unsubs: 34, unsubRate: 0.1 },
  { date: '2026-01-22 19:00', name: "FY26 Indiana Jones KYBG - SATURDAY", sends: 366, opens: 254, openRate: 70, mobileOpen: 73.2, desktopOpen: 26.8, clicks: 93, clickRate: 25.6, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-21 19:00', name: "FY26 Indiana Jones KYBG - FRIDAY", sends: 387, opens: 262, openRate: 68.2, mobileOpen: 71.5, desktopOpen: 28.5, clicks: 107, clickRate: 27.9, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-21 13:14', name: "FY26 Indiana Jones KYBG - THURSDAY", sends: 421, opens: 288, openRate: 69.1, mobileOpen: 59.8, desktopOpen: 40.2, clicks: 110, clickRate: 26.4, bounces: 4, bounceRate: 1, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-20 20:00', name: "FY26 1/20 Weekly Concert Promo", sends: 96353, opens: 35721, openRate: 38.5, mobileOpen: 31.3, desktopOpen: 68.7, clicks: 499, clickRate: 0.5, bounces: 3556, bounceRate: 3.7, unsubs: 40, unsubRate: 0.1 },
  { date: '2026-01-16 20:00', name: "FY26 CS5 KYBG - SUNDAY", sends: 375, opens: 258, openRate: 69.5, mobileOpen: 63, desktopOpen: 37, clicks: 66, clickRate: 17.8, bounces: 4, bounceRate: 1.1, unsubs: 1, unsubRate: 0.3 },
  { date: '2026-01-16 10:20', name: "FY26 Music & The Mind KBYG", sends: 1, opens: 1, openRate: 100, mobileOpen: 25, desktopOpen: 75, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-15 19:00', name: "FY26 CS5 KYBG - SATURDAY", sends: 389, opens: 248, openRate: 64.9, mobileOpen: 46.9, desktopOpen: 53.1, clicks: 67, clickRate: 17.5, bounces: 7, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-15 13:00', name: "FY26 She's Got Soul Standalone #1", sends: 96407, opens: 34351, openRate: 37, mobileOpen: 25.6, desktopOpen: 74.4, clicks: 236, clickRate: 0.3, bounces: 3494, bounceRate: 3.6, unsubs: 42, unsubRate: 0.1 },
  { date: '2026-01-14 19:00', name: "FY26 CS5 KYBG - FRIDAY", sends: 214, opens: 150, openRate: 70.8, mobileOpen: 52.7, desktopOpen: 47.3, clicks: 40, clickRate: 18.9, bounces: 2, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-13 14:29', name: "FY26 1/13 Weekly Concert Promo", sends: 96458, opens: 35225, openRate: 37.9, mobileOpen: 29, desktopOpen: 71, clicks: 401, clickRate: 0.4, bounces: 3510, bounceRate: 3.6, unsubs: 28, unsubRate: 0.1 },
  { date: '2026-01-12 17:25', name: "FY26 Piazza Subscription Update - Customer Facing", sends: 373, opens: 293, openRate: 79.6, mobileOpen: 44.9, desktopOpen: 55.1, clicks: 2, clickRate: 0.5, bounces: 5, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-12 10:00', name: "FY26 Sempre Brunch Invite Reminder", sends: 66, opens: 50, openRate: 76.9, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 10, clickRate: 15.4, bounces: 1, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-09 09:30', name: "FY26 CS4 KYBG - SUNDAY", sends: 399, opens: 260, openRate: 65.7, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 88, clickRate: 22.2, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-08 19:00', name: "FY26 CS4 KYBG - SATURDAY", sends: 358, opens: 240, openRate: 68, mobileOpen: 53.4, desktopOpen: 46.6, clicks: 74, clickRate: 21, bounces: 5, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-08 14:38', name: "FY26 On Stage 2 Standalone #1", sends: 96583, opens: 35503, openRate: 38.1, mobileOpen: 30.2, desktopOpen: 69.8, clicks: 267, clickRate: 0.3, bounces: 3467, bounceRate: 3.6, unsubs: 40, unsubRate: 0.1 },
  { date: '2026-01-08 09:48', name: "FY26 CS4 KYBG - FRIDAY", sends: 359, opens: 240, openRate: 67, mobileOpen: 55.9, desktopOpen: 44.1, clicks: 75, clickRate: 20.9, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-06 14:00', name: "FY26 Season Announcement Invite - Reminder", sends: 201, opens: 142, openRate: 70.6, mobileOpen: 38.9, desktopOpen: 61.1, clicks: 12, clickRate: 6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-06 11:39', name: "FY26 1/6 Weekly Concert Promo", sends: 96485, opens: 34861, openRate: 37.5, mobileOpen: 24.4, desktopOpen: 75.6, clicks: 395, clickRate: 0.4, bounces: 3495, bounceRate: 3.6, unsubs: 34, unsubRate: 0.1 },
  { date: '2026-01-01 09:00', name: "FY26 Indiana Jones Standalone #1", sends: 96612, opens: 35202, openRate: 37.8, mobileOpen: 31, desktopOpen: 69, clicks: 529, clickRate: 0.6, bounces: 3507, bounceRate: 3.6, unsubs: 35, unsubRate: 0.1 },
  { date: '2025-12-30 09:00', name: "FY26 12/30 Weekly Concert Promo", sends: 96729, opens: 34555, openRate: 37.1, mobileOpen: 26.5, desktopOpen: 73.5, clicks: 393, clickRate: 0.4, bounces: 3526, bounceRate: 3.6, unsubs: 56, unsubRate: 0.1 },
  { date: '2025-12-26 09:00', name: "FY26 CS6 Standalone #1", sends: 96863, opens: 34760, openRate: 37.2, mobileOpen: 30.9, desktopOpen: 69.1, clicks: 274, clickRate: 0.3, bounces: 3516, bounceRate: 3.6, unsubs: 42, unsubRate: 0.1 },
  { date: '2025-12-23 15:03', name: "FY26 12/23 Weekly Concert Promo", sends: 96939, opens: 35172, openRate: 37.7, mobileOpen: 33.1, desktopOpen: 66.9, clicks: 308, clickRate: 0.3, bounces: 3625, bounceRate: 3.7, unsubs: 36, unsubRate: 0.1 },
  { date: '2025-12-22 19:00', name: "FY26 IAWL KYBG - WEDNESDAY", sends: 279, opens: 200, openRate: 72.2, mobileOpen: 73.1, desktopOpen: 26.9, clicks: 90, clickRate: 32.5, bounces: 2, bounceRate: 0.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-22 16:36', name: "FY26 IAWL KYBG - TUESDAY", sends: 273, opens: 197, openRate: 72.4, mobileOpen: 73.1, desktopOpen: 26.9, clicks: 78, clickRate: 28.7, bounces: 1, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-19 13:00', name: "FY26 Christmas Festival KYBG - SUNDAY 2PM", sends: 273, opens: 182, openRate: 67.9, mobileOpen: 62.8, desktopOpen: 37.2, clicks: 81, clickRate: 30.2, bounces: 5, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-19 13:00', name: "FY26 Christmas Festival KYBG - SUNDAY 7PM", sends: 205, opens: 134, openRate: 67, mobileOpen: 77.1, desktopOpen: 22.9, clicks: 49, clickRate: 24.5, bounces: 5, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-18 19:00', name: "FY26 Christmas Festival KYBG - SATURDAY 1PM", sends: 264, opens: 175, openRate: 67.6, mobileOpen: 76.3, desktopOpen: 23.7, clicks: 70, clickRate: 27, bounces: 5, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-18 19:00', name: "FY26 Christmas Festival KYBG - SATURDAY 7PM", sends: 239, opens: 167, openRate: 71.4, mobileOpen: 75.6, desktopOpen: 24.4, clicks: 58, clickRate: 24.8, bounces: 5, bounceRate: 2.1, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-18 14:45', name: "FY26 Christmas Festival KYBG - FRIDAY", sends: 229, opens: 142, openRate: 62.6, mobileOpen: 71.7, desktopOpen: 28.3, clicks: 61, clickRate: 26.9, bounces: 2, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-17 13:43', name: "FY26 Christmas Festival KYBG - THURSDAY", sends: 237, opens: 156, openRate: 66.4, mobileOpen: 63.7, desktopOpen: 36.3, clicks: 79, clickRate: 33.6, bounces: 2, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-17 10:48', name: "FY26 Sempre Brunch Invite", sends: 80, opens: 63, openRate: 79.7, mobileOpen: 16.7, desktopOpen: 83.3, clicks: 13, clickRate: 16.5, bounces: 1, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-16 17:00', name: "FY26 DEVO | Prelude Invitation", sends: 155, opens: 101, openRate: 65.6, mobileOpen: 16.7, desktopOpen: 83.3, clicks: 2, clickRate: 1.3, bounces: 1, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-16 17:00', name: "FY26 DEVO | Baton Invitation", sends: 159, opens: 96, openRate: 60.4, mobileOpen: 20, desktopOpen: 80, clicks: 2, clickRate: 1.3, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-16 13:17', name: "FY26 12/16 Weekly Concert Promo", sends: 96421, opens: 34642, openRate: 37.3, mobileOpen: 36.3, desktopOpen: 63.7, clicks: 481, clickRate: 0.5, bounces: 3473, bounceRate: 3.6, unsubs: 30, unsubRate: 0.1 },
  { date: '2025-12-15 17:00', name: "FY26 DEVO | EOY Email", sends: 4862, opens: 2140, openRate: 44.9, mobileOpen: 40, desktopOpen: 60, clicks: 13, clickRate: 0.3, bounces: 96, bounceRate: 2, unsubs: 5, unsubRate: 0.1 },
  { date: '2025-12-15 15:20', name: "FY26 Active Non Pops Subscribers - Customer Feedback Survey #1", sends: 195, opens: 103, openRate: 53.6, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 18, clickRate: 9.4, bounces: 3, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-15 14:35', name: "FY26 DEVO | CF Family Sub Suite Invite", sends: 52, opens: 33, openRate: 63.5, mobileOpen: 59.3, desktopOpen: 40.7, clicks: 14, clickRate: 26.9, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-15 14:33', name: "FY26 Lapsed Pops Subscribers - Customer Feedback Survey #1", sends: 199, opens: 114, openRate: 58.2, mobileOpen: 34.6, desktopOpen: 65.4, clicks: 35, clickRate: 17.9, bounces: 3, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-15 14:22', name: "FY26 Current Pops Subs - Customer Feedback Survey #1", sends: 429, opens: 267, openRate: 62.8, mobileOpen: 45.9, desktopOpen: 54.1, clicks: 108, clickRate: 25.4, bounces: 4, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-15 09:35', name: "FY26 Christmas Festival Rehearsal Reception KBYG", sends: 101, opens: 87, openRate: 89.7, mobileOpen: 14.3, desktopOpen: 85.7, clicks: 1, clickRate: 1, bounces: 4, bounceRate: 4, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-11 19:00', name: "FY26 LOJ Christmas Tour KYBG - SAT", sends: 533, opens: 399, openRate: 75.9, mobileOpen: 77.7, desktopOpen: 22.3, clicks: 205, clickRate: 39, bounces: 7, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-11 14:32', name: "FY26 CS4 Standalone #1", sends: 96528, opens: 34622, openRate: 37.2, mobileOpen: 26.1, desktopOpen: 73.9, clicks: 234, clickRate: 0.3, bounces: 3517, bounceRate: 3.6, unsubs: 41, unsubRate: 0.1 },
  { date: '2025-12-10 19:00', name: "FY26 LOJ Christmas Tour KYBG - FRI", sends: 561, opens: 420, openRate: 75.5, mobileOpen: 79.8, desktopOpen: 20.2, clicks: 230, clickRate: 41.4, bounces: 5, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-10 15:29', name: "FY26 Season Announcement Invite", sends: 234, opens: 181, openRate: 77.4, mobileOpen: 30.1, desktopOpen: 69.9, clicks: 37, clickRate: 15.8, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-09 10:03', name: "FY26 12/9 Weekly Concert Promo", sends: 96133, opens: 34307, openRate: 37, mobileOpen: 29, desktopOpen: 71, clicks: 440, clickRate: 0.5, bounces: 3379, bounceRate: 3.5, unsubs: 33, unsubRate: 0.1 },
  { date: '2025-12-05 13:00', name: "FY26 Handel's Messiah KYBG - SUN", sends: 342, opens: 223, openRate: 67.4, mobileOpen: 52.4, desktopOpen: 47.6, clicks: 106, clickRate: 32, bounces: 11, bounceRate: 3.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-05 09:00', name: "FY26 12/5 Petite Performances 9:30 Reminder", sends: 47, opens: 41, openRate: 87.2, mobileOpen: 100, desktopOpen: 0, clicks: 7, clickRate: 14.9, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-05 09:00', name: "FY26 12/5 Petite Performances 10:30 Reminder", sends: 46, opens: 42, openRate: 91.3, mobileOpen: 69.2, desktopOpen: 30.8, clicks: 8, clickRate: 17.4, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-05 09:00', name: "FY26 12/5 Petite Performances 11:30 Reminder", sends: 32, opens: 23, openRate: 71.9, mobileOpen: 75, desktopOpen: 25, clicks: 5, clickRate: 15.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-04 19:00', name: "FY26 CS5 Standalone #1", sends: 96232, opens: 35634, openRate: 38.4, mobileOpen: 34.3, desktopOpen: 65.7, clicks: 304, clickRate: 0.3, bounces: 3438, bounceRate: 3.6, unsubs: 31, unsubRate: 0.1 },
  { date: '2025-12-04 16:32', name: "FY26 Handel's Messiah KYBG - SAT", sends: 292, opens: 192, openRate: 66.9, mobileOpen: 66.5, desktopOpen: 33.5, clicks: 86, clickRate: 30, bounces: 5, bounceRate: 1.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-04 16:31', name: "FY26 Handel's Messiah KYBG - FRI (Resend)", sends: 318, opens: 217, openRate: 69.3, mobileOpen: 68.7, desktopOpen: 31.3, clicks: 105, clickRate: 33.5, bounces: 5, bounceRate: 1.6, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-03 19:00', name: "FY26 Handel's Messiah KYBG - FRI", sends: 346, opens: 192, openRate: 56.1, mobileOpen: 46.4, desktopOpen: 53.6, clicks: 19, clickRate: 5.6, bounces: 4, bounceRate: 1.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-12-02 10:08', name: "FY26 12/2 Weekly Concert Promo", sends: 95984, opens: 34134, openRate: 36.8, mobileOpen: 29.8, desktopOpen: 70.2, clicks: 499, clickRate: 0.5, bounces: 3351, bounceRate: 3.5, unsubs: 33, unsubRate: 0.1 },
  { date: '2025-12-01 10:17', name: "FY26 BFCM Deals: Promo Email 3", sends: 96078, opens: 33797, openRate: 36.5, mobileOpen: 25.3, desktopOpen: 74.7, clicks: 317, clickRate: 0.3, bounces: 3364, bounceRate: 3.5, unsubs: 43, unsubRate: 0.1 },
  { date: '2025-12-01 08:30', name: "FY26 KinderKonzert", sends: 1239, opens: 533, openRate: 52.3, mobileOpen: 25.7, desktopOpen: 74.3, clicks: 74, clickRate: 7.3, bounces: 219, bounceRate: 17.7, unsubs: 1, unsubRate: 0.1 },
  { date: '2025-11-28 10:00', name: "FY26 Elf KBYG - Sunday", sends: 240, opens: 173, openRate: 73.9, mobileOpen: 75.8, desktopOpen: 24.2, clicks: 81, clickRate: 34.6, bounces: 6, bounceRate: 2.5, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-28 08:00', name: "FY26 Black Friday Deals: Promo Email 2", sends: 96189, opens: 35013, openRate: 37.7, mobileOpen: 43.6, desktopOpen: 56.4, clicks: 1641, clickRate: 1.8, bounces: 3305, bounceRate: 3.4, unsubs: 41, unsubRate: 0.1 },
  { date: '2025-11-27 09:00', name: "FY26 Elf KBYG - Saturday 7PM", sends: 218, opens: 156, openRate: 71.9, mobileOpen: 85.3, desktopOpen: 14.7, clicks: 70, clickRate: 32.3, bounces: 1, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-27 09:00', name: "FY26 Elf KBYG - Saturday 1PM", sends: 190, opens: 139, openRate: 73.9, mobileOpen: 78, desktopOpen: 22, clicks: 74, clickRate: 39.4, bounces: 2, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-26 16:07', name: "FY26 Elf KBYG - Friday", sends: 234, opens: 172, openRate: 73.8, mobileOpen: 79.7, desktopOpen: 20.3, clicks: 83, clickRate: 35.6, bounces: 1, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-25 13:17', name: "FY26 11/24 Weekly Concert Promo", sends: 95968, opens: 34761, openRate: 37.5, mobileOpen: 28.6, desktopOpen: 71.4, clicks: 320, clickRate: 0.3, bounces: 3295, bounceRate: 3.4, unsubs: 31, unsubRate: 0.1 },
  { date: '2025-11-21 10:00', name: "FY26 CS3 - KBYG SUN", sends: 394, opens: 275, openRate: 70, mobileOpen: 40.3, desktopOpen: 59.7, clicks: 77, clickRate: 19.6, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-21 09:18', name: "FY26 Black Friday Deals: Promo Email 1", sends: 96071, opens: 34360, openRate: 37, mobileOpen: 30.3, desktopOpen: 69.7, clicks: 262, clickRate: 0.3, bounces: 3287, bounceRate: 3.4, unsubs: 40, unsubRate: 0.1 },
  { date: '2025-11-20 19:00', name: "FY26 CS3 - KBYG FRI", sends: 261, opens: 174, openRate: 66.9, mobileOpen: 62.8, desktopOpen: 37.2, clicks: 57, clickRate: 21.9, bounces: 1, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-20 19:00', name: "FY26 CS3 - KBYG SAT", sends: 386, opens: 252, openRate: 66.5, mobileOpen: 54.8, desktopOpen: 45.2, clicks: 77, clickRate: 20.3, bounces: 7, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-18 11:33', name: "FY26 11/17 Weekly Concert Promo", sends: 96036, opens: 34484, openRate: 37.2, mobileOpen: 28.1, desktopOpen: 71.9, clicks: 328, clickRate: 0.4, bounces: 3294, bounceRate: 3.4, unsubs: 28, unsubRate: 0.1 },
  { date: '2025-11-17 11:52', name: "FY26 CS3 Matthias Video", sends: 96088, opens: 34953, openRate: 37.7, mobileOpen: 24, desktopOpen: 76, clicks: 554, clickRate: 0.6, bounces: 3277, bounceRate: 3.4, unsubs: 21, unsubRate: 0.1 },
  { date: '2025-11-14 11:13', name: "FY26 Christmas Festival Rehearsal Reception Invite", sends: 354, opens: 270, openRate: 76.5, mobileOpen: 32.6, desktopOpen: 67.4, clicks: 60, clickRate: 17, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-13 10:53', name: "FY26 Christmas Festival Standalone #1", sends: 96184, opens: 34991, openRate: 37.6, mobileOpen: 29.7, desktopOpen: 70.3, clicks: 486, clickRate: 0.5, bounces: 3243, bounceRate: 3.4, unsubs: 22, unsubRate: 0.1 },
  { date: '2025-11-11 11:47', name: "FY26 11/11 Weekly Concert Promo", sends: 103359, opens: 35703, openRate: 38.4, mobileOpen: 29.6, desktopOpen: 70.4, clicks: 634, clickRate: 0.7, bounces: 10324, bounceRate: 10, unsubs: 21, unsubRate: 0.1 },
  { date: '2025-11-07 12:57', name: "FY26 Carnival Games Reminder", sends: 153, opens: 130, openRate: 85.5, mobileOpen: 37.2, desktopOpen: 62.8, clicks: 21, clickRate: 13.8, bounces: 1, bounceRate: 0.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-11-05 10:59', name: "FY26 Classical Subscription Packages", sends: 101453, opens: 34140, openRate: 37.4, mobileOpen: 27.1, desktopOpen: 72.9, clicks: 1305, clickRate: 1.4, bounces: 10231, bounceRate: 10.1, unsubs: 25, unsubRate: 0.1 },
  { date: '2025-11-04 14:14', name: "FY26 11/4 Weekly Concert Promo", sends: 103471, opens: 35469, openRate: 38.1, mobileOpen: 29, desktopOpen: 71, clicks: 517, clickRate: 0.6, bounces: 10297, bounceRate: 10, unsubs: 13, unsubRate: 0.1 },
  { date: '2025-11-04 08:00', name: "FY26 Family 2 Email 2025/11/03 05:26:40 PM", sends: 3251, opens: 1538, openRate: 49.3, mobileOpen: 39, desktopOpen: 61, clicks: 41, clickRate: 1.3, bounces: 131, bounceRate: 4, unsubs: 2, unsubRate: 0.1 },
  { date: '2025-10-31 10:15', name: "DB Donor Message 2025-10-30", sends: 1105, opens: 755, openRate: 72.5, mobileOpen: 29.7, desktopOpen: 70.3, clicks: 16, clickRate: 1.5, bounces: 63, bounceRate: 5.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-31 09:00', name: "FY26 CS2 - KBYG SUN", sends: 513, opens: 340, openRate: 68.8, mobileOpen: 37.7, desktopOpen: 62.3, clicks: 105, clickRate: 21.3, bounces: 19, bounceRate: 3.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-30 15:02', name: "FY26 CS2 - KBYG SAT", sends: 523, opens: 356, openRate: 71.1, mobileOpen: 64.1, desktopOpen: 35.9, clicks: 109, clickRate: 21.8, bounces: 22, bounceRate: 4.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-30 14:58', name: "FY26 CS2 - KBYG FRI", sends: 280, opens: 181, openRate: 67.5, mobileOpen: 55.9, desktopOpen: 44.1, clicks: 63, clickRate: 23.5, bounces: 12, bounceRate: 4.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-29 15:42', name: "FY26 On Stage 1 - KBYG 10/29", sends: 23, opens: 19, openRate: 86.4, mobileOpen: 0, desktopOpen: 100, clicks: 1, clickRate: 4.5, bounces: 1, bounceRate: 4.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-29 13:59', name: "FY26 CS2 Matthias Video", sends: 103396, opens: 34678, openRate: 37.2, mobileOpen: 34.3, desktopOpen: 65.7, clicks: 696, clickRate: 0.7, bounces: 10221, bounceRate: 9.9, unsubs: 29, unsubRate: 0.1 },
  { date: '2025-10-28 11:45', name: "FY26 10/28 Weekly Concert Promo", sends: 103449, opens: 34486, openRate: 37, mobileOpen: 35.8, desktopOpen: 64.2, clicks: 348, clickRate: 0.4, bounces: 10173, bounceRate: 9.8, unsubs: 32, unsubRate: 0.1 },
  { date: '2025-10-24 09:00', name: "FY26 90s Mixtape - KBYG 10/26 SUN", sends: 258, opens: 191, openRate: 77.3, mobileOpen: 61, desktopOpen: 39, clicks: 67, clickRate: 27.1, bounces: 11, bounceRate: 4.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-23 20:00', name: "FY26 Elf Standalone Email #2", sends: 103537, opens: 36081, openRate: 38.6, mobileOpen: 41.9, desktopOpen: 58.1, clicks: 564, clickRate: 0.6, bounces: 10161, bounceRate: 9.8, unsubs: 24, unsubRate: 0.1 },
  { date: '2025-10-23 15:51', name: "FY26 90s Mixtape - KBYG 10/25 SAT", sends: 330, opens: 240, openRate: 75.5, mobileOpen: 70.6, desktopOpen: 29.4, clicks: 87, clickRate: 27.4, bounces: 12, bounceRate: 3.6, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-23 15:48', name: "FY26 90s Mixtape - KBYG 10/24 FRI", sends: 328, opens: 232, openRate: 73, mobileOpen: 52, desktopOpen: 48, clicks: 67, clickRate: 21.1, bounces: 10, bounceRate: 3, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-21 18:00', name: "FY26 10/21 Weekly Concert Promo", sends: 103565, opens: 36100, openRate: 38.6, mobileOpen: 35.3, desktopOpen: 64.7, clicks: 450, clickRate: 0.5, bounces: 10087, bounceRate: 9.7, unsubs: 28, unsubRate: 0.1 },
  { date: '2025-10-21 17:44', name: "FY26 The Lodger - CORRECTED KBYG 10/22 WED", sends: 130, opens: 89, openRate: 70.6, mobileOpen: 52.2, desktopOpen: 47.8, clicks: 32, clickRate: 25.4, bounces: 4, bounceRate: 3.1, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-21 17:32', name: "FY26 10/21 Email Correction", sends: 330, opens: 260, openRate: 81.8, mobileOpen: 49.1, desktopOpen: 50.9, clicks: 12, clickRate: 3.8, bounces: 12, bounceRate: 3.6, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-21 15:42', name: "FY26 The Lodger - KBYG 10/22 WED", sends: 337, opens: 218, openRate: 67.5, mobileOpen: 45.1, desktopOpen: 54.9, clicks: 15, clickRate: 4.6, bounces: 14, bounceRate: 4.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-17 14:00', name: "FY26 Top Gun - KBYG 10/19 SUN", sends: 286, opens: 202, openRate: 72.1, mobileOpen: 67.6, desktopOpen: 32.4, clicks: 81, clickRate: 28.9, bounces: 6, bounceRate: 2.1, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-16 19:00', name: "FY26 Top Gun - KBYG 10/18 SAT", sends: 373, opens: 262, openRate: 72.6, mobileOpen: 78.1, desktopOpen: 21.9, clicks: 106, clickRate: 29.4, bounces: 12, bounceRate: 3.2, unsubs: 1, unsubRate: 0.3 },
  { date: '2025-10-16 09:00', name: "FY26 CS3 Standalone Email #2", sends: 103590, opens: 34664, openRate: 37.1, mobileOpen: 25.2, desktopOpen: 74.8, clicks: 229, clickRate: 0.2, bounces: 10087, bounceRate: 9.7, unsubs: 37, unsubRate: 0.1 },
  { date: '2025-10-15 19:00', name: "FY26 Top Gun - KBYG 10/17 FRI", sends: 356, opens: 263, openRate: 75.6, mobileOpen: 65.1, desktopOpen: 34.9, clicks: 117, clickRate: 33.6, bounces: 8, bounceRate: 2.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-15 10:00', name: "FY26 Holiday Standalone #2", sends: 103631, opens: 35213, openRate: 37.6, mobileOpen: 33.9, desktopOpen: 66.1, clicks: 602, clickRate: 0.6, bounces: 10063, bounceRate: 9.7, unsubs: 29, unsubRate: 0.1 },
  { date: '2025-10-14 09:00', name: "FY26 10/14 Weekly Concert Promo", sends: 103693, opens: 35572, openRate: 38, mobileOpen: 32.6, desktopOpen: 67.4, clicks: 562, clickRate: 0.6, bounces: 10057, bounceRate: 9.7, unsubs: 39, unsubRate: 0.1 },
  { date: '2025-10-10 17:07', name: "FY26 CS1 - KBYG 10/12 SUN", sends: 547, opens: 394, openRate: 74.8, mobileOpen: 52.8, desktopOpen: 47.2, clicks: 139, clickRate: 26.4, bounces: 20, bounceRate: 3.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-10 17:04', name: "FY26 CS1 - KBYG 10/11 SAT", sends: 458, opens: 307, openRate: 69.6, mobileOpen: 59.2, desktopOpen: 40.8, clicks: 107, clickRate: 24.3, bounces: 17, bounceRate: 3.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-10 13:14', name: "SSY Message 2025-10-10", sends: 379, opens: 310, openRate: 83.8, mobileOpen: 44.2, desktopOpen: 55.8, clicks: 7, clickRate: 1.9, bounces: 9, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-10 12:21', name: "FY26 10/11 Petite Performances 11:30 Reminder", sends: 22, opens: 17, openRate: 81, mobileOpen: 11.1, desktopOpen: 88.9, clicks: 7, clickRate: 33.3, bounces: 1, bounceRate: 4.5, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-10 12:11', name: "FY26 10/11 Petite Performances 10:30 Reminder", sends: 29, opens: 26, openRate: 96.3, mobileOpen: 24, desktopOpen: 76, clicks: 9, clickRate: 33.3, bounces: 2, bounceRate: 6.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-10 12:07', name: "FY26 10/11 Petite Performances 9:30 Reminder", sends: 24, opens: 21, openRate: 91.3, mobileOpen: 10, desktopOpen: 90, clicks: 10, clickRate: 43.5, bounces: 1, bounceRate: 4.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-09 19:30', name: "FY26 CS1 - KBYG 10/10 FRI", sends: 450, opens: 310, openRate: 70.9, mobileOpen: 64.3, desktopOpen: 35.7, clicks: 93, clickRate: 21.3, bounces: 13, bounceRate: 2.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-10-09 09:00', name: "FY26 Handel's Messiah Standalone #1", sends: 103204, opens: 34290, openRate: 36.8, mobileOpen: 29.4, desktopOpen: 70.6, clicks: 428, clickRate: 0.5, bounces: 10083, bounceRate: 9.8, unsubs: 30, unsubRate: 0.1 },
  { date: '2025-10-08 10:54', name: "FY26 Holiday Standalone #1", sends: 103257, opens: 34877, openRate: 37.4, mobileOpen: 29.3, desktopOpen: 70.7, clicks: 438, clickRate: 0.5, bounces: 10013, bounceRate: 9.7, unsubs: 30, unsubRate: 0.1 },
  { date: '2025-10-07 09:00', name: "FY26 10/7 Weekly Concert Promo", sends: 103311, opens: 34392, openRate: 36.9, mobileOpen: 24.3, desktopOpen: 75.7, clicks: 505, clickRate: 0.5, bounces: 10020, bounceRate: 9.7, unsubs: 23, unsubRate: 0.1 },
  { date: '2025-10-02 10:01', name: "FY26 Elf Standalone Email", sends: 103391, opens: 35150, openRate: 37.7, mobileOpen: 32, desktopOpen: 68, clicks: 751, clickRate: 0.8, bounces: 10088, bounceRate: 9.8, unsubs: 36, unsubRate: 0.1 },
  { date: '2025-09-30 14:13', name: "FY26 9/30 Weekly Concert Promo", sends: 103461, opens: 35820, openRate: 38.3, mobileOpen: 29.2, desktopOpen: 70.8, clicks: 426, clickRate: 0.5, bounces: 10006, bounceRate: 9.7, unsubs: 32, unsubRate: 0.1 },
  { date: '2025-09-27 09:00', name: "FY26 Orchestra Games Reminder", sends: 172, opens: 133, openRate: 80.6, mobileOpen: 43.4, desktopOpen: 56.6, clicks: 12, clickRate: 7.3, bounces: 7, bounceRate: 4.1, unsubs: 0, unsubRate: 0 },
  { date: '2025-09-25 13:43', name: "FY26 CS3 Standalone Email", sends: 103519, opens: 35979, openRate: 38.5, mobileOpen: 22.9, desktopOpen: 77.1, clicks: 348, clickRate: 0.4, bounces: 9953, bounceRate: 9.6, unsubs: 38, unsubRate: 0.1 },
  { date: '2025-09-24 19:41', name: "FY26 9/23 CS1 Standalone Email", sends: 103566, opens: 36930, openRate: 39.4, mobileOpen: 24.6, desktopOpen: 75.4, clicks: 321, clickRate: 0.3, bounces: 9953, bounceRate: 9.6, unsubs: 26, unsubRate: 0.1 },
  { date: '2025-09-23 12:45', name: "FY26 9/23 Weekly Concert Promo", sends: 103643, opens: 35711, openRate: 38.1, mobileOpen: 26.8, desktopOpen: 73.2, clicks: 475, clickRate: 0.5, bounces: 9957, bounceRate: 9.6, unsubs: 35, unsubRate: 0.1 },
  { date: '2025-09-19 11:29', name: "FY26 Journey - KBYG 9/21 SUN", sends: 359, opens: 262, openRate: 75.5, mobileOpen: 65.9, desktopOpen: 34.1, clicks: 103, clickRate: 29.7, bounces: 12, bounceRate: 3.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-09-19 11:27', name: "FY26 Journey - KBYG 9/20 SAT", sends: 419, opens: 292, openRate: 73.7, mobileOpen: 57.8, desktopOpen: 42.2, clicks: 105, clickRate: 26.5, bounces: 23, bounceRate: 5.5, unsubs: 0, unsubRate: 0 },
  { date: '2025-09-19 08:10', name: "FY26 Journey - KBYG 9/19 FRI", sends: 434, opens: 293, openRate: 70.4, mobileOpen: 59.9, desktopOpen: 40.1, clicks: 101, clickRate: 24.3, bounces: 18, bounceRate: 4.1, unsubs: 0, unsubRate: 0 },
  { date: '2025-09-18 09:00', name: "FY26 9/18 90s Standalone Email", sends: 103487, opens: 34995, openRate: 37.4, mobileOpen: 24.7, desktopOpen: 75.3, clicks: 366, clickRate: 0.4, bounces: 9937, bounceRate: 9.6, unsubs: 25, unsubRate: 0.1 },
  { date: '2025-09-16 14:59', name: "FY26 9/16 Weekly Concert Promo", sends: 103544, opens: 35745, openRate: 38.1, mobileOpen: 30, desktopOpen: 70, clicks: 741, clickRate: 0.8, bounces: 9832, bounceRate: 9.5, unsubs: 24, unsubRate: 0.1 },
  { date: '2025-09-15 16:02', name: "FY26 9/15 CS2 Standalone Email", sends: 103598, opens: 35612, openRate: 38, mobileOpen: 25.7, desktopOpen: 74.3, clicks: 356, clickRate: 0.4, bounces: 9805, bounceRate: 9.5, unsubs: 29, unsubRate: 0.1 },
  { date: '2025-09-11 09:00', name: "FY26 9/10 Journey Giveaway", sends: 103666, opens: 35635, openRate: 38, mobileOpen: 25.2, desktopOpen: 74.8, clicks: 772, clickRate: 0.8, bounces: 9806, bounceRate: 9.5, unsubs: 30, unsubRate: 0.1 },
  { date: '2025-09-09 14:27', name: "FY26 9/9 Weekly Concert Promo", sends: 103722, opens: 36340, openRate: 38.7, mobileOpen: 28.7, desktopOpen: 71.3, clicks: 790, clickRate: 0.8, bounces: 9760, bounceRate: 9.4, unsubs: 29, unsubRate: 0.1 },
  { date: '2025-09-05 14:27', name: "FY26 9/5 CS1 BOGO Promo Pops Buyers", sends: 4701, opens: 2520, openRate: 56.3, mobileOpen: 44.8, desktopOpen: 55.2, clicks: 106, clickRate: 2.4, bounces: 228, bounceRate: 4.9, unsubs: 1, unsubRate: 0.1 },
  { date: '2025-09-05 12:35', name: "FY25 Recording Session Invite(2)", sends: 516, opens: 385, openRate: 77.2, mobileOpen: 30.1, desktopOpen: 69.9, clicks: 70, clickRate: 14, bounces: 17, bounceRate: 3.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-09-05 11:08', name: "FY26 9/5 CS1 BOGO Promo - Morgan Freeman first time buyers", sends: 1050, opens: 615, openRate: 61.1, mobileOpen: 30.5, desktopOpen: 69.5, clicks: 36, clickRate: 3.6, bounces: 44, bounceRate: 4.2, unsubs: 0, unsubRate: 0 },
  { date: '2025-09-04 16:35', name: "FY26 9/4 CS1 Matthias Video", sends: 103722, opens: 36846, openRate: 39.2, mobileOpen: 21.6, desktopOpen: 78.4, clicks: 1516, clickRate: 1.6, bounces: 9731, bounceRate: 9.4, unsubs: 35, unsubRate: 0.1 },
  { date: '2025-09-04 12:18', name: "FY26 9/4 Journey - BOGO Promo", sends: 3025, opens: 1210, openRate: 44.9, mobileOpen: 37.5, desktopOpen: 62.5, clicks: 57, clickRate: 2.1, bounces: 329, bounceRate: 10.9, unsubs: 0, unsubRate: 0 },
  { date: '2025-08-31 08:00', name: "FY26 Morgan Freeman KBYG 9/3 WED", sends: 389, opens: 307, openRate: 81.6, mobileOpen: 62.6, desktopOpen: 37.4, clicks: 129, clickRate: 34.3, bounces: 13, bounceRate: 3.3, unsubs: 0, unsubRate: 0 },
  { date: '2025-08-31 08:00', name: "FY26 Morgan Freeman KBYG 9/2 TUES", sends: 438, opens: 356, openRate: 83.6, mobileOpen: 69.6, desktopOpen: 30.4, clicks: 152, clickRate: 35.7, bounces: 12, bounceRate: 2.7, unsubs: 0, unsubRate: 0 },
  { date: '2025-08-29 08:00', name: "FY26 La nuit sombre KBYG 9/5", sends: 260, opens: 214, openRate: 85.6, mobileOpen: 57.2, desktopOpen: 42.8, clicks: 67, clickRate: 26.8, bounces: 10, bounceRate: 3.8, unsubs: 0, unsubRate: 0 },
  { date: '2025-08-27 10:40', name: "FY26 8/27 Chicken Fried Promo", sends: 103211, opens: 36047, openRate: 38.5, mobileOpen: 26.6, desktopOpen: 73.4, clicks: 542, clickRate: 0.6, bounces: 9525, bounceRate: 9.2, unsubs: 48, unsubRate: 0.1 },
  { date: '2025-08-20 15:18', name: "FY26 8/20 Weekly Concert Promo", sends: 103367, opens: 36511, openRate: 38.9, mobileOpen: 36.1, desktopOpen: 63.9, clicks: 797, clickRate: 0.8, bounces: 9471, bounceRate: 9.2, unsubs: 31, unsubRate: 0.1 },
  { date: '2025-08-12 13:33', name: "FY26 8/12 Music of Journey Promo", sends: 103511, opens: 36698, openRate: 38.9, mobileOpen: 27.1, desktopOpen: 72.9, clicks: 597, clickRate: 0.6, bounces: 9273, bounceRate: 9, unsubs: 54, unsubRate: 0.1 },
  { date: '2025-08-06 12:35', name: "FY26 8/6 Weekly Concert Promo", sends: 103618, opens: 37068, openRate: 39.3, mobileOpen: 35.8, desktopOpen: 64.2, clicks: 977, clickRate: 1, bounces: 9298, bounceRate: 9, unsubs: 31, unsubRate: 0.1 },
  { date: '2025-08-01 11:47', name: "FY26 7/31 La Nuit Sombre Matthias Video", sends: 103745, opens: 37034, openRate: 39.2, mobileOpen: 18.8, desktopOpen: 81.2, clicks: 522, clickRate: 0.6, bounces: 9286, bounceRate: 9, unsubs: 43, unsubRate: 0.1 },
  { date: '2025-07-24 09:00', name: "FY26 7/23 Morgan Freeman Promo", sends: 103881, opens: 36637, openRate: 38.7, mobileOpen: 28.9, desktopOpen: 71.1, clicks: 848, clickRate: 0.9, bounces: 9298, bounceRate: 9, unsubs: 41, unsubRate: 0.1 },
  { date: '2025-07-15 10:15', name: "FY26 7/15 Single Ticket On Sale Announcement", sends: 104010, opens: 36330, openRate: 38.3, mobileOpen: 38, desktopOpen: 62, clicks: 1760, clickRate: 1.9, bounces: 9182, bounceRate: 8.8, unsubs: 46, unsubRate: 0.1 },
  { date: '2025-07-08 09:00', name: "FY25 7/8 LOJ Promo", sends: 104107, opens: 36640, openRate: 38.6, mobileOpen: 27, desktopOpen: 73, clicks: 582, clickRate: 0.6, bounces: 9183, bounceRate: 8.8, unsubs: 34, unsubRate: 0.1 },
  { date: '2025-07-01 10:20', name: "FY25 7/1 Holiday Single Tickets On Sale", sends: 104205, opens: 36069, openRate: 37.9, mobileOpen: 30.7, desktopOpen: 69.3, clicks: 854, clickRate: 0.9, bounces: 9149, bounceRate: 8.8, unsubs: 31, unsubRate: 0.1 },
].filter(c => c.sends != null);

let emailSortCol = 'date';
let emailSortAsc = false;

function categorize(name) {
  const n = name.toLowerCase();
  if (n.includes('kbyg') || n.includes('kybg')) return 'KBYG';
  if (n.includes('weekly concert') || n.includes('catch up')) return 'Weekly Promo';
  if (n.includes('standalone') || n.includes('cats email') || n.includes('billy joel') || n.includes('eu tour')) return 'Event Promo';
  if (n.includes('subscriber') || n.includes('renewal') || n.includes('subscription')) return 'Subscriber';
  if (n.includes('match appeal') || n.includes('donor') || n.includes('nmv') || n.includes('contributor')) return 'Development';
  if (n.includes('season') || n.includes('new subscriber')) return 'Season/Acquisition';
  if (n.includes('vip') || n.includes('chairman') || n.includes('invite')) return 'VIP/Events';
  if (n.includes('follow-up') || n.includes('follow up')) return 'Follow-Up';
  return 'Other';
}

const CATEGORY_COLORS = {
  'KBYG': '#2563eb',
  'Weekly Promo': '#7c3aed',
  'Event Promo': '#dc2626',
  'Subscriber': '#0d9488',
  'Development': '#d97706',
  'Season/Acquisition': '#059669',
  'VIP/Events': '#be185d',
  'Follow-Up': '#ea580c',
  'Other': '#94a3b8',
};

function renderEmailCards() {
  const container = document.querySelector('.marketing-content');
  if (!container) return;

  const s = EMAIL_SUMMARY;
  const campaigns = EMAIL_CAMPAIGNS;

  const section = document.createElement('div');
  section.id = 'email-section';
  section.innerHTML = `
    <div style="margin-top: 32px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border-color);">
      <h2 style="font-size: 16px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-secondary); margin: 0;">Email Marketing</h2>
      <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0;">${s.periodLabel} · vs. previous 12 months</p>
    </div>

    <div class="kpi-row" style="grid-template-columns: repeat(6, 1fr);">
      <div class="kpi-card">
        <div class="kpi-label">Emails Sent</div>
        <div class="kpi-bottom"><span class="kpi-value">${fmt(s.sent)}</span>${changeBadge(s.sent, s.sentPrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Delivered</div>
        <div class="kpi-bottom"><span class="kpi-value">${fmt(s.delivered)}</span><span class="kpi-badge flat">${((s.delivered / s.sent) * 100).toFixed(0)}%</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Open Rate</div>
        <div class="kpi-bottom"><span class="kpi-value">${(s.openRate * 100).toFixed(0)}%</span>${changeBadge(s.openRate, s.openRatePrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Click Rate</div>
        <div class="kpi-bottom"><span class="kpi-value">${(s.clickRate * 100).toFixed(0)}%</span><span class="kpi-badge flat">${(s.clickToOpenRate * 100).toFixed(0)}% CTO</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Bounced</div>
        <div class="kpi-bottom"><span class="kpi-value">${fmt(s.bounced)}</span>${changeBadge(s.bounced, s.bouncedPrev)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Unsubscribed</div>
        <div class="kpi-bottom"><span class="kpi-value">${fmt(s.unsubscribed)}</span>${changeBadge(s.unsubscribed, s.unsubscribedPrev)}</div>
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <h3>Email Funnel</h3>
        <div id="email-funnel-chart"></div>
      </div>
      <div class="card">
        <h3>Opens & Clicks by Device</h3>
        <div id="email-device-chart"></div>
      </div>
    </div>

    <div class="card">
      <h3>Campaign Performance</h3>
      <p class="card-subtitle">${campaigns.length} campaigns · Last 12 months · Click column headers to sort</p>
      <div class="channel-table-wrap">
        <table>
          <thead>
            <tr>
              <th class="email-sort" data-col="date" style="cursor:pointer;">Date ▼</th>
              <th class="email-sort" data-col="name" style="cursor:pointer;">Campaign</th>
              <th class="email-sort" data-col="category" style="cursor:pointer;">Type</th>
              <th class="num email-sort" data-col="sends" style="cursor:pointer;">Sends</th>
              <th class="num email-sort" data-col="openRate" style="cursor:pointer;">Open Rate</th>
              <th class="num email-sort" data-col="clickRate" style="cursor:pointer;">Click Rate</th>
              <th class="num email-sort" data-col="clicks" style="cursor:pointer;">Clicks</th>
              <th class="num email-sort" data-col="bounceRate" style="cursor:pointer;">Bounce %</th>
              <th class="num email-sort" data-col="unsubs" style="cursor:pointer;">Unsubs</th>
              <th class="num">Device Split</th>
            </tr>
          </thead>
          <tbody id="email-campaign-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  container.appendChild(section);

  renderEmailFunnel();
  renderDeviceChart();
  renderCampaignTable();

  section.querySelectorAll('.email-sort').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (emailSortCol === col) emailSortAsc = !emailSortAsc;
      else { emailSortCol = col; emailSortAsc = col === 'name'; }
      renderCampaignTable();
    });
  });
}

function renderEmailFunnel() {
  const s = EMAIL_SUMMARY;
  const steps = [
    { label: 'Sent', value: s.sent, pct: '100%' },
    { label: 'Delivered', value: s.delivered, pct: ((s.delivered / s.sent) * 100).toFixed(0) + '%' },
    { label: 'Opened', value: s.opened, pct: ((s.opened / s.sent) * 100).toFixed(0) + '%' },
    { label: 'Clicked', value: s.clicked, pct: ((s.clicked / s.sent) * 100).toFixed(1) + '%' },
  ];

  const el = d3.select('#email-funnel-chart');
  const width = el.node().getBoundingClientRect().width;
  const height = 220;
  const svg = el.append('svg').attr('width', width).attr('height', height);
  const barH = 36;
  const gap = 14;
  const startY = 20;
  const maxW = width - 140;
  const maxVal = steps[0].value;

  steps.forEach((step, i) => {
    const y = startY + i * (barH + gap);
    const w = Math.max((step.value / maxVal) * maxW, 4);
    const colors = ['#667eea', '#5a6fd6', '#4a5dc2', '#3b4dae'];

    svg.append('rect').attr('x', 120).attr('y', y).attr('width', w).attr('height', barH)
      .attr('fill', colors[i]).attr('rx', 4).attr('opacity', 0.85);

    svg.append('text').attr('x', 112).attr('y', y + barH / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'end').attr('fill', '#111').attr('font-size', 13).attr('font-weight', 600)
      .text(step.label);

    svg.append('text').attr('x', 128 + w).attr('y', y + barH / 2).attr('dy', '0.35em')
      .attr('fill', '#111').attr('font-size', 12).attr('font-weight', 500)
      .text(`${fmt(step.value)} (${step.pct})`);
  });
}

function renderDeviceChart() {
  const s = EMAIL_SUMMARY;
  const el = d3.select('#email-device-chart');
  const width = el.node().getBoundingClientRect().width;
  const height = 220;
  const svg = el.append('svg').attr('width', width).attr('height', height);

  const metrics = [
    { label: 'Opens', mobile: s.mobileOpenPct, desktop: s.desktopOpenPct },
    { label: 'Clicks', mobile: s.mobileClickPct, desktop: s.desktopClickPct },
  ];

  const barH = 40;
  const gap = 50;
  const startY = 30;
  const maxW = width - 160;
  const x0 = 100;

  metrics.forEach((m, i) => {
    const y = startY + i * (barH + gap);
    const mobileW = m.mobile * maxW;
    const desktopW = m.desktop * maxW;

    svg.append('text').attr('x', x0 - 12).attr('y', y + barH / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'end').attr('fill', '#111').attr('font-size', 13).attr('font-weight', 600)
      .text(m.label);

    svg.append('rect').attr('x', x0).attr('y', y).attr('width', mobileW).attr('height', barH)
      .attr('fill', '#667eea').attr('rx', 4).attr('opacity', 0.85);
    svg.append('rect').attr('x', x0 + mobileW).attr('y', y).attr('width', desktopW).attr('height', barH)
      .attr('fill', '#2d3748').attr('rx', 4).attr('opacity', 0.7);

    svg.append('text').attr('x', x0 + mobileW / 2).attr('y', y + barH / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 12).attr('font-weight', 600)
      .text(`${(m.mobile * 100).toFixed(0)}% Mobile`);
    svg.append('text').attr('x', x0 + mobileW + desktopW / 2).attr('y', y + barH / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 12).attr('font-weight', 600)
      .text(`${(m.desktop * 100).toFixed(0)}% Desktop`);
  });
}

function renderCampaignTable() {
  const tbody = document.getElementById('email-campaign-tbody');
  if (!tbody) return;

  const data = EMAIL_CAMPAIGNS.map(c => ({ ...c, category: categorize(c.name) }));

  data.sort((a, b) => {
    let va, vb;
    if (emailSortCol === 'category') { va = a.category; vb = b.category; }
    else if (emailSortCol === 'name') { va = a.name; vb = b.name; }
    else if (emailSortCol === 'date') { va = a.date; vb = b.date; }
    else { va = a[emailSortCol] || 0; vb = b[emailSortCol] || 0; }

    if (typeof va === 'string') return emailSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return emailSortAsc ? va - vb : vb - va;
  });

  const formatDate = d => {
    const dt = new Date(d.replace(' ', 'T'));
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  tbody.innerHTML = data.map(c => {
    const catColor = CATEGORY_COLORS[c.category] || '#94a3b8';
    const orClass = c.openRate >= 60 ? 'cr-good' : c.openRate < 30 ? 'cr-poor' : '';
    const crClass = c.clickRate >= 15 ? 'cr-good' : '';
    const mobileW = Math.round(c.mobileOpen);
    return `<tr>
      <td style="white-space:nowrap; font-size:12px; color:var(--text-secondary);">${formatDate(c.date)}</td>
      <td style="font-size:12px; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.name}">${c.name.replace('FY26 ', '')}</td>
      <td><span style="font-size:10px; padding:2px 8px; border-radius:10px; background:${catColor}15; color:${catColor}; font-weight:600;">${c.category}</span></td>
      <td class="num">${fmt(c.sends)}</td>
      <td class="num ${orClass}">${c.openRate.toFixed(1)}%</td>
      <td class="num ${crClass}">${c.clickRate.toFixed(1)}%</td>
      <td class="num">${fmt(c.clicks)}</td>
      <td class="num">${c.bounceRate.toFixed(1)}%</td>
      <td class="num">${c.unsubs}</td>
      <td class="num" style="font-size:11px;"><span style="color:#667eea;">${mobileW}%</span> / <span style="color:#2d3748;">${100 - mobileW}%</span></td>
    </tr>`;
  }).join('');
}

// Email cards are rendered by the tab-switching code in marketing.html
// when channel-performance tab is active — no DOMContentLoaded needed.
