const EMAIL_SUMMARY = {
  sent: 2162626,
  delivered: 2085729,
  opened: 746963,
  clicked: 19750,
  openRate: 0.36,
  clickRate: 0.01,
  clickToOpenRate: 0.03,
  bounced: 76897,
  unsubscribed: 1018,
  openRatePrev: 0.38,
  clickRatePrev: 0.01,
  sentPrev: 4170002,
  deliveredPrev: 3857942,
  bouncedPrev: 312060,
  unsubscribedPrev: 1316,
  mobileOpenPct: 0.37,
  desktopOpenPct: 0.63,
  mobileClickPct: 0.27,
  desktopClickPct: 0.73,
  periodLabel: 'Jan 1 – May 21, 2026 (141 days)',
};

const EMAIL_CAMPAIGNS = [
  { date: '2026-05-21 16:00', name: 'FY26 New Subscriber Acquisition #3', sends: null },
  { date: '2026-05-21 10:04', name: 'FY26 CATS VIP KBYG - NO PARKING', sends: 7, opens: 5, openRate: 71.4, mobileOpen: 14.3, desktopOpen: 85.7, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-21 10:02', name: 'FY26 CATS VIP KBYG - 1 Parking Pass', sends: 41, opens: 33, openRate: 80.5, mobileOpen: 25.0, desktopOpen: 75.0, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-20 20:00', name: 'FY26 Ben Rector KBYG - FRIDAY 5/22', sends: 495, opens: 293, openRate: 59.8, mobileOpen: 77.9, desktopOpen: 22.1, clicks: 135, clickRate: 27.6, bounces: 5, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-19 20:00', name: 'FY26 Ben Rector KBYG - THURSDAY 5/21', sends: 400, opens: 239, openRate: 60.8, mobileOpen: 80.0, desktopOpen: 20.0, clicks: 105, clickRate: 26.7, bounces: 7, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-19 16:00', name: 'FY26 5/19 - CATS Email 2', sends: 109021, opens: 35110, openRate: 33.8, mobileOpen: 36.0, desktopOpen: 64.0, clicks: 649, clickRate: 0.6, bounces: 5225, bounceRate: 4.8, unsubs: 51, unsubRate: 0.1 },
  { date: '2026-05-18 13:30', name: 'FY26 Subscriber Courtesy Week', sends: 1804, opens: 1180, openRate: 65.9, mobileOpen: 28.1, desktopOpen: 71.9, clicks: 100, clickRate: 5.6, bounces: 13, bounceRate: 0.7, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-05-18 10:00', name: 'FY26 Dolly Parton Follow-Up #3 Sunday', sends: 433, opens: 217, openRate: 50.9, mobileOpen: 15.4, desktopOpen: 84.6, clicks: 8, clickRate: 1.9, bounces: 7, bounceRate: 1.6, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-05-17 10:00', name: 'FY26 Dolly Parton Follow-Up #2 Saturday', sends: 380, opens: 208, openRate: 55.2, mobileOpen: 51.5, desktopOpen: 48.5, clicks: 15, clickRate: 4.0, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-16 10:00', name: 'FY26 Dolly Parton Follow-Up #1 Friday', sends: 411, opens: 212, openRate: 52.6, mobileOpen: 27.6, desktopOpen: 72.4, clicks: 11, clickRate: 2.7, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-15 18:00', name: 'FY26 Dolly Parton KBYG - SUNDAY 5/17', sends: 381, opens: 243, openRate: 64.8, mobileOpen: 68.5, desktopOpen: 31.5, clicks: 98, clickRate: 26.1, bounces: 6, bounceRate: 1.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-15 15:00', name: 'FY26 Match Appeal 5.15', sends: 18801, opens: 7042, openRate: 38.5, mobileOpen: 34.8, desktopOpen: 65.2, clicks: 51, clickRate: 0.3, bounces: 493, bounceRate: 2.6, unsubs: 11, unsubRate: 0.1 },
  { date: '2026-05-15 14:30', name: 'FY26 EU Tour Sale - General Audience', sends: 29780, opens: 10889, openRate: 37.6, mobileOpen: 39.5, desktopOpen: 60.5, clicks: 156, clickRate: 0.5, bounces: 795, bounceRate: 2.7, unsubs: 27, unsubRate: 0.1 },
  { date: '2026-05-15 14:00', name: 'FY26 5/15 - Mobile Music Box Email', sends: 38, opens: 27, openRate: 73.0, mobileOpen: 29.0, desktopOpen: 71.0, clicks: 11, clickRate: 29.7, bounces: 1, bounceRate: 2.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-14 18:00', name: 'FY26 Dolly Parton KBYG - SATURDAY 5/16', sends: 349, opens: 235, openRate: 67.5, mobileOpen: 67.9, desktopOpen: 32.1, clicks: 71, clickRate: 20.4, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-13 18:00', name: 'FY26 Dolly Parton KBYG - FRIDAY 5/15', sends: 388, opens: 263, openRate: 68.5, mobileOpen: 60.1, desktopOpen: 39.9, clicks: 81, clickRate: 21.1, bounces: 4, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-13 09:15', name: "FY26 Contributors' Concert Invite - 3rd Wave", sends: 1830, opens: 1149, openRate: 64.1, mobileOpen: 42.8, desktopOpen: 57.2, clicks: 353, clickRate: 19.7, bounces: 38, bounceRate: 2.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-12 16:00', name: 'FY26 EU Tour Pre-Sale #2 - Subscribers & Donors', sends: 2887, opens: 1598, openRate: 56.5, mobileOpen: 36.9, desktopOpen: 63.1, clicks: 126, clickRate: 4.5, bounces: 59, bounceRate: 2.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-11 10:30', name: "FY26 Contributors' Concert Invite - 2nd Wave", sends: 117, opens: 93, openRate: 79.5, mobileOpen: 37.3, desktopOpen: 62.7, clicks: 37, clickRate: 31.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-11 10:00', name: 'FY26 CS11 Follow-Up #3 Sunday', sends: 420, opens: 238, openRate: 57.5, mobileOpen: 31.7, desktopOpen: 68.3, clicks: 20, clickRate: 4.8, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-10 10:00', name: 'FY26 CS11 Follow-Up #2 Saturday', sends: 407, opens: 236, openRate: 59.1, mobileOpen: 37.7, desktopOpen: 62.3, clicks: 13, clickRate: 3.3, bounces: 8, bounceRate: 2.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-09 10:00', name: 'FY26 CS11 Follow-Up #1 Friday', sends: 340, opens: 196, openRate: 58.7, mobileOpen: 26.2, desktopOpen: 73.8, clicks: 10, clickRate: 3.0, bounces: 6, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 14:00', name: 'FY26 CS11 KBYG - SUNDAY', sends: 415, opens: 276, openRate: 67.5, mobileOpen: 52.7, desktopOpen: 47.3, clicks: 88, clickRate: 21.5, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 11:30', name: 'FY26 5/9 Petite Performances 11:30 Reminder', sends: 41, opens: 31, openRate: 79.5, mobileOpen: 44.4, desktopOpen: 55.6, clicks: 4, clickRate: 10.3, bounces: 2, bounceRate: 4.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 11:13', name: 'FY26 CATS VIP Invite - Auxiliaries', sends: 45, opens: 29, openRate: 64.4, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 2, clickRate: 4.4, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 10:30', name: 'FY26 5/9 Petite Performances 10:30 Reminder', sends: 56, opens: 42, openRate: 77.8, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 6, clickRate: 11.1, bounces: 2, bounceRate: 3.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-08 09:30', name: 'FY26 5/9 Petite Performances 9:30 Reminder', sends: 50, opens: 37, openRate: 75.5, mobileOpen: 57.1, desktopOpen: 42.9, clicks: 3, clickRate: 6.1, bounces: 1, bounceRate: 2.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-07 20:00', name: 'FY26 CS11 KBYG - SATURDAY', sends: 385, opens: 245, openRate: 64.5, mobileOpen: 57.1, desktopOpen: 42.9, clicks: 78, clickRate: 20.5, bounces: 5, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-07 19:00', name: 'FY26 New Subscriber Acquisition #2', sends: 2646, opens: 1174, openRate: 45.3, mobileOpen: 49.0, desktopOpen: 51.0, clicks: 28, clickRate: 1.1, bounces: 56, bounceRate: 2.1, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-05-07 16:23', name: 'FY26 EU Tour Pre-Sale #1 - Symphony Society', sends: 337, opens: 239, openRate: 71.3, mobileOpen: 29.5, desktopOpen: 70.5, clicks: 32, clickRate: 9.6, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-07 11:10', name: 'FY26 CATS VIP Invite Follow Up - Board & $30k', sends: 35, opens: 24, openRate: 68.6, mobileOpen: 35.7, desktopOpen: 64.3, clicks: 3, clickRate: 8.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-06 20:00', name: 'FY26 CS11 KBYG - FRIDAY', sends: 276, opens: 186, openRate: 68.1, mobileOpen: 45.1, desktopOpen: 54.9, clicks: 60, clickRate: 22.0, bounces: 3, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-06 10:02', name: "FY26 Contributors' Concert Invite - 1st Wave", sends: 41, opens: 29, openRate: 70.7, mobileOpen: 44.4, desktopOpen: 55.6, clicks: 10, clickRate: 24.4, bounces: 0, bounceRate: 0, unsubs: 1, unsubRate: 2.4 },
  { date: '2026-05-06 09:20', name: 'FY26 CATS VIP Invite Follow Up - Fanfare, Overture, Sempre, Prelude, Baton', sends: 544, opens: 341, openRate: 63.4, mobileOpen: 41.3, desktopOpen: 58.7, clicks: 12, clickRate: 2.2, bounces: 6, bounceRate: 1.1, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-05-05 16:30', name: 'FY26 5/5 Weekly Concert Promo CS13', sends: 1095, opens: 560, openRate: 52.4, mobileOpen: 29.8, desktopOpen: 70.2, clicks: 22, clickRate: 2.1, bounces: 26, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-05 15:36', name: 'FY26 5/5 - Mobile Music Box Email 2', sends: 49, opens: 36, openRate: 75.0, mobileOpen: 50.0, desktopOpen: 50.0, clicks: 4, clickRate: 8.3, bounces: 1, bounceRate: 2.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-04 12:12', name: 'FY26 Business Alliance Showhouse Invite', sends: 2, opens: 2, openRate: 100.0, mobileOpen: 0, desktopOpen: 100.0, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-05-01 14:49', name: 'FY26 5/1 - Mobile Music Box Email 1', sends: 68, opens: 44, openRate: 65.7, mobileOpen: 50.0, desktopOpen: 50.0, clicks: 12, clickRate: 17.9, bounces: 1, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-30 18:00', name: 'FY26 4/30 - CATS Email 1', sends: 109140, opens: 37586, openRate: 36.1, mobileOpen: 36.9, desktopOpen: 63.1, clicks: 563, clickRate: 0.5, bounces: 5106, bounceRate: 4.7, unsubs: 73, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: 'FY26 4/28 Weekly Concert Update Ben Rector -- CE CONTROL GROUP', sends: 1369, opens: 626, openRate: 46.6, mobileOpen: 25.5, desktopOpen: 74.5, clicks: 10, clickRate: 0.7, bounces: 26, bounceRate: 1.9, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: 'FY26 4/28 Weekly Concert Promo CS12 - CE COMBO', sends: 22839, opens: 10218, openRate: 45.7, mobileOpen: 47.6, desktopOpen: 52.4, clicks: 138, clickRate: 0.6, bounces: 495, bounceRate: 2.2, unsubs: 28, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: 'FY26 4/28 Weekly Concert Promo CS12 - CA COMBO', sends: 7010, opens: 3150, openRate: 46.2, mobileOpen: 48.3, desktopOpen: 51.7, clicks: 53, clickRate: 0.8, bounces: 193, bounceRate: 2.8, unsubs: 5, unsubRate: 0.1 },
  { date: '2026-04-28 16:00', name: 'FY26 4/28 Weekly Concert Promo CS12 - CA CONTROL', sends: 416, opens: 199, openRate: 48.8, mobileOpen: 26.8, desktopOpen: 73.2, clicks: 8, clickRate: 2.0, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-24 12:09', name: 'FY26 4/22 - Dolly, CS11, CS12 Promo - BOGO', sends: 1086, opens: 575, openRate: 53.6, mobileOpen: 31.5, desktopOpen: 68.5, clicks: 20, clickRate: 1.9, bounces: 14, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-23 16:00', name: 'FY26 New Subscriber 4/23', sends: 2787, opens: 1309, openRate: 47.9, mobileOpen: 49.2, desktopOpen: 50.8, clicks: 30, clickRate: 1.1, bounces: 54, bounceRate: 1.9, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-04-22 11:42', name: 'FY26 CATS VIP Invite - Fanfare, Overture, Sempre, Prelude, Baton', sends: 554, opens: 381, openRate: 69.5, mobileOpen: 42.0, desktopOpen: 58.0, clicks: 43, clickRate: 7.8, bounces: 6, bounceRate: 1.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-22 11:41', name: 'FY26 CATS VIP Invite - Crescendo & Bravura', sends: 122, opens: 97, openRate: 79.5, mobileOpen: 34.8, desktopOpen: 65.2, clicks: 21, clickRate: 17.2, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-21 16:00', name: 'FY26 4/21 Weekly Concert Update Steve Hackman -- CE CONTROL GROUP', sends: 1366, opens: 652, openRate: 48.6, mobileOpen: 37.9, desktopOpen: 62.1, clicks: 13, clickRate: 1.0, bounces: 25, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-21 16:00', name: 'FY26 4/21 Weekly Concert Promo CS11 - CA CONTROL', sends: 413, opens: 197, openRate: 48.9, mobileOpen: 24.0, desktopOpen: 76.0, clicks: 4, clickRate: 1.0, bounces: 10, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-21 16:00', name: 'FY26 4/21 Weekly Concert Update Steve Hackman -- CE COMBO', sends: 22868, opens: 10811, openRate: 48.3, mobileOpen: 53.9, desktopOpen: 46.1, clicks: 344, clickRate: 1.5, bounces: 491, bounceRate: 2.1, unsubs: 29, unsubRate: 0.1 },
  { date: '2026-04-21 16:00', name: 'FY26 4/21 Weekly Concert Update Steve Hackman -- CA COMBO', sends: 7014, opens: 3290, openRate: 48.2, mobileOpen: 48.7, desktopOpen: 51.3, clicks: 77, clickRate: 1.1, bounces: 186, bounceRate: 2.7, unsubs: 7, unsubRate: 0.1 },
  { date: '2026-04-17 14:00', name: 'FY26 CS10 KBYG - SUNDAY', sends: 369, opens: 243, openRate: 66.4, mobileOpen: 37.1, desktopOpen: 62.9, clicks: 61, clickRate: 16.7, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-17 11:00', name: 'FY26 Match Appeal 4.17', sends: 18843, opens: 7327, openRate: 39.9, mobileOpen: 35.7, desktopOpen: 64.3, clicks: 76, clickRate: 0.4, bounces: 460, bounceRate: 2.4, unsubs: 10, unsubRate: 0.1 },
  { date: '2026-04-16 20:00', name: 'FY26 CS10 KBYG - SATURDAY', sends: 329, opens: 213, openRate: 66.4, mobileOpen: 40.0, desktopOpen: 60.0, clicks: 51, clickRate: 15.9, bounces: 8, bounceRate: 2.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-16 16:16', name: 'FY26 Film Subscription Announcement 4/16', sends: 2788, opens: 1374, openRate: 50.3, mobileOpen: 49.5, desktopOpen: 50.5, clicks: 83, clickRate: 3.0, bounces: 55, bounceRate: 2.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-15 20:00', name: 'FY26 CS10 KBYG - FRIDAY', sends: 329, opens: 236, openRate: 72.0, mobileOpen: 31.6, desktopOpen: 68.4, clicks: 54, clickRate: 16.5, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-14 16:00', name: 'FY26 4/14 Weekly Concert Update Dolly Parton Threads -- CE CONTROL GROUP', sends: 1371, opens: 624, openRate: 46.3, mobileOpen: 41.2, desktopOpen: 58.8, clicks: 12, clickRate: 0.9, bounces: 23, bounceRate: 1.7, unsubs: 4, unsubRate: 0.3 },
  { date: '2026-04-14 16:00', name: 'FY26 4/14 Weekly Concert CS14 - Classical Aficionado COMBO', sends: 7022, opens: 3360, openRate: 49.1, mobileOpen: 40.5, desktopOpen: 59.5, clicks: 96, clickRate: 1.4, bounces: 184, bounceRate: 2.6, unsubs: 8, unsubRate: 0.1 },
  { date: '2026-04-14 16:00', name: 'FY26 4/14 Weekly Concert CS14 - Curious Explorer COMBO', sends: 22903, opens: 10437, openRate: 46.6, mobileOpen: 48.1, desktopOpen: 51.9, clicks: 170, clickRate: 0.8, bounces: 495, bounceRate: 2.2, unsubs: 30, unsubRate: 0.1 },
  { date: '2026-04-14 16:00', name: 'FY26 4/14 Weekly Concert Promo CS14 - CA CONTROL', sends: 413, opens: 198, openRate: 48.9, mobileOpen: 44.0, desktopOpen: 56.0, clicks: 3, clickRate: 0.7, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-14 15:12', name: 'FY26 CATS VIP Invite - Board & $30k', sends: 40, opens: 31, openRate: 77.5, mobileOpen: 70.5, desktopOpen: 29.5, clicks: 9, clickRate: 22.5, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-10 14:59', name: 'FY26 CS9 KBYG - CORRECTION EMAIL', sends: 1060, opens: 716, openRate: 68.3, mobileOpen: 45.2, desktopOpen: 54.8, clicks: 10, clickRate: 1.0, bounces: 11, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-10 14:00', name: 'FY26 CS9 KBYG - SUNDAY', sends: 402, opens: 272, openRate: 68.5, mobileOpen: 47.1, desktopOpen: 52.9, clicks: 80, clickRate: 20.2, bounces: 5, bounceRate: 1.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-09 20:00', name: 'FY26 CS9 KBYG - SATURDAY', sends: 374, opens: 255, openRate: 69.1, mobileOpen: 60.2, desktopOpen: 39.8, clicks: 76, clickRate: 20.6, bounces: 5, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-08 20:00', name: 'FY26 CS9 KBYG - FRIDAY', sends: 309, opens: 219, openRate: 71.3, mobileOpen: 48.8, desktopOpen: 51.2, clicks: 72, clickRate: 23.5, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-07 18:00', name: 'FY26 4/7 Weekly Concert CS13 - Curious Explorer COMBO', sends: 22966, opens: 10461, openRate: 46.5, mobileOpen: 46.3, desktopOpen: 53.7, clicks: 125, clickRate: 0.6, bounces: 482, bounceRate: 2.1, unsubs: 31, unsubRate: 0.1 },
  { date: '2026-04-07 18:00', name: 'FY26 4/7 Weekly Concert Update PP: Goldilocks -- CE CONTROL GROUP', sends: 1375, opens: 648, openRate: 48.0, mobileOpen: 43.1, desktopOpen: 56.9, clicks: 15, clickRate: 1.1, bounces: 24, bounceRate: 1.7, unsubs: 3, unsubRate: 0.2 },
  { date: '2026-04-07 18:00', name: 'FY26 4/7 Weekly Concert Promo CS13 - CA CONTROL', sends: 415, opens: 197, openRate: 48.4, mobileOpen: 33.3, desktopOpen: 66.7, clicks: 3, clickRate: 0.7, bounces: 8, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-04-07 18:00', name: 'FY26 4/7 Weekly Concert CS13 - Classical Aficionado COMBO', sends: 7039, opens: 3304, openRate: 48.2, mobileOpen: 44.4, desktopOpen: 55.6, clicks: 81, clickRate: 1.2, bounces: 181, bounceRate: 2.6, unsubs: 8, unsubRate: 0.1 },
  { date: '2026-04-03 09:22', name: 'FY26 4/2 Catch Up Ben Rector -- Curious Explorer', sends: 3945, opens: 1839, openRate: 47.0, mobileOpen: 43.5, desktopOpen: 56.5, clicks: 37, clickRate: 0.9, bounces: 32, bounceRate: 0.8, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-04-03 09:00', name: 'FY26 4/2 Catch Up Ben Rector -- Classical Aficionado', sends: 4092, opens: 1680, openRate: 41.7, mobileOpen: 36.4, desktopOpen: 63.6, clicks: 30, clickRate: 0.7, bounces: 66, bounceRate: 1.6, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-04-02 19:00', name: 'FY26 NMV - General Interest Catch Up Send 4/2', sends: 29944, opens: 12551, openRate: 43.0, mobileOpen: 48.4, desktopOpen: 51.6, clicks: 403, clickRate: 1.4, bounces: 746, bounceRate: 2.5, unsubs: 45, unsubRate: 0.2 },
  { date: '2026-04-02 11:59', name: 'FY26 NMV - Donor Follow Up 4/2', sends: 1409, opens: 825, openRate: 59.3, mobileOpen: 33.1, desktopOpen: 66.9, clicks: 49, clickRate: 3.5, bounces: 18, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-31 16:00', name: 'FY26 3/31 Weekly Concert Update Ben Rector -- Curious Explorer CONTROL GROUP', sends: 229, opens: 120, openRate: 53.3, mobileOpen: 14.3, desktopOpen: 85.7, clicks: 3, clickRate: 1.3, bounces: 4, bounceRate: 1.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-31 16:00', name: 'FY26 3/31 Weekly Concert Update Ben Rector -- Curious Explorer MAIN AUDIENCE', sends: 478, opens: 257, openRate: 54.6, mobileOpen: 34.6, desktopOpen: 65.4, clicks: 6, clickRate: 1.3, bounces: 7, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-31 16:00', name: 'FY26 3/31 Weekly Concert Promo CS12 - Classical Aficionado CONTROL', sends: 265, opens: 133, openRate: 51.4, mobileOpen: 64.7, desktopOpen: 35.3, clicks: 3, clickRate: 1.2, bounces: 6, bounceRate: 2.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-30 13:22', name: 'EJT Donor Message on NMV TRUE', sends: 818, opens: 572, openRate: 71.0, mobileOpen: 33.3, desktopOpen: 66.7, clicks: 13, clickRate: 1.6, bounces: 12, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-30 08:33', name: 'FY26 NMV External Announcement 3/30', sends: 30475, opens: 13309, openRate: 45.5, mobileOpen: 46.3, desktopOpen: 53.7, clicks: 799, clickRate: 2.7, bounces: 1202, bounceRate: 3.9, unsubs: 32, unsubRate: 0.1 },
  { date: '2026-03-27 14:15', name: 'FY26 Match Appeal 3.27', sends: 18974, opens: 7421, openRate: 40.0, mobileOpen: 34.7, desktopOpen: 65.3, clicks: 74, clickRate: 0.4, bounces: 443, bounceRate: 2.3, unsubs: 24, unsubRate: 0.1 },
  { date: '2026-03-27 14:00', name: 'FY26 Billy Joel & Elton John KYBG - SUNDAY 3/29', sends: 473, opens: 324, openRate: 69.8, mobileOpen: 61.9, desktopOpen: 38.1, clicks: 137, clickRate: 29.5, bounces: 9, bounceRate: 1.9, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-03-27 09:00', name: 'FY26 Subscriber Renewal: Last Chance 3/27 - Pops and Family', sends: 310, opens: 178, openRate: 57.6, mobileOpen: 38.0, desktopOpen: 62.0, clicks: 16, clickRate: 5.2, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-27 09:00', name: 'FY26 Subscriber Renewal: Last Chance 3/27 - Classical', sends: 471, opens: 273, openRate: 58.7, mobileOpen: 27.6, desktopOpen: 72.4, clicks: 37, clickRate: 8.0, bounces: 6, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-26 20:00', name: 'FY26 Billy Joel & Elton John KYBG - SATURDAY 3/28', sends: 475, opens: 347, openRate: 73.2, mobileOpen: 73.4, desktopOpen: 26.6, clicks: 134, clickRate: 28.3, bounces: 1, bounceRate: 0.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-25 20:00', name: 'FY26 Billy Joel & Elton John KYBG - FRIDAY 3/27', sends: 491, opens: 335, openRate: 68.8, mobileOpen: 60.7, desktopOpen: 39.3, clicks: 117, clickRate: 24.0, bounces: 4, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-24 19:00', name: 'FY26 Final Symphony KYBG - THURSDAY 3/26', sends: 308, opens: 175, openRate: 57.0, mobileOpen: 85.2, desktopOpen: 14.8, clicks: 85, clickRate: 27.7, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-24 16:00', name: 'FY26 3/24 Weekly Concert Promo On Stage Gil Shaham - Classical Aficionado', sends: 4869, opens: 2057, openRate: 42.9, mobileOpen: 41.6, desktopOpen: 58.4, clicks: 45, clickRate: 0.9, bounces: 76, bounceRate: 1.6, unsubs: 4, unsubRate: 0.1 },
  { date: '2026-03-24 16:00', name: 'FY26 3/24 Weekly Concert Update Steve Hackman -- Curious Explorer', sends: 4643, opens: 2417, openRate: 52.5, mobileOpen: 60.4, desktopOpen: 39.6, clicks: 246, clickRate: 5.3, bounces: 39, bounceRate: 0.8, unsubs: 3, unsubRate: 0.1 },
  { date: '2026-03-23 19:00', name: 'FY26 Final Symphony KYBG - WEDNESDAY 3/25', sends: 351, opens: 229, openRate: 65.2, mobileOpen: 80.5, desktopOpen: 19.5, clicks: 110, clickRate: 31.3, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-19 16:00', name: 'FY26 Subscriber Renewal: Count Down Timer 3/19 - Classical', sends: 683, opens: 428, openRate: 63.4, mobileOpen: 25.5, desktopOpen: 74.5, clicks: 64, clickRate: 9.5, bounces: 8, bounceRate: 1.2, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-19 16:00', name: 'FY26 Subscriber Renewal: Count Down Timer 3/19 - Pops and Family', sends: 399, opens: 241, openRate: 60.7, mobileOpen: 31.1, desktopOpen: 68.9, clicks: 32, clickRate: 8.1, bounces: 2, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-17 18:00', name: 'FY26 3/17 Weekly Concert Promo CS11 - Classical Aficionado', sends: 9805, opens: 4051, openRate: 42.3, mobileOpen: 41.2, desktopOpen: 58.8, clicks: 120, clickRate: 1.3, bounces: 238, bounceRate: 2.4, unsubs: 9, unsubRate: 0.1 },
  { date: '2026-03-17 18:00', name: "FY26 3/17 Weekly Concert Update Dolly Parton's Threads -- Curious Explorer", sends: 7348, opens: 3177, openRate: 43.7, mobileOpen: 42.4, desktopOpen: 57.6, clicks: 80, clickRate: 1.1, bounces: 74, bounceRate: 1.0, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-03-17 16:51', name: "FY26 Chairman's Invite - Reminder & Update", sends: 61, opens: 45, openRate: 73.8, mobileOpen: 37.9, desktopOpen: 62.1, clicks: 10, clickRate: 16.4, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 14:00', name: 'FY26 CS8 KYBG - SUNDAY 3/15', sends: 365, opens: 265, openRate: 73.2, mobileOpen: 46.9, desktopOpen: 53.1, clicks: 81, clickRate: 22.4, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 11:30', name: 'FY26 3/14 Petite Performances 11:30 Reminder', sends: 46, opens: 37, openRate: 80.4, mobileOpen: 81.8, desktopOpen: 18.2, clicks: 4, clickRate: 8.7, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 10:30', name: 'FY26 3/14 Petite Performances 10:30 Reminder', sends: 53, opens: 48, openRate: 92.3, mobileOpen: 80.6, desktopOpen: 19.4, clicks: 12, clickRate: 23.1, bounces: 1, bounceRate: 1.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-13 09:30', name: 'FY26 3/14 Petite Performances 9:30 Reminder', sends: 48, opens: 41, openRate: 85.4, mobileOpen: 66.7, desktopOpen: 33.3, clicks: 8, clickRate: 16.7, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-12 20:00', name: 'FY26 CS8 KYBG - SATURDAY 3/14', sends: 296, opens: 204, openRate: 69.6, mobileOpen: 45.6, desktopOpen: 54.4, clicks: 56, clickRate: 19.1, bounces: 3, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-12 18:30', name: "FY26 Subscriber Renewal: Don't Miss Out 3/12 - Pops and Family", sends: 489, opens: 294, openRate: 60.4, mobileOpen: 27.3, desktopOpen: 72.7, clicks: 15, clickRate: 3.1, bounces: 2, bounceRate: 0.4, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-03-12 18:30', name: "FY26 Subscriber Renewal: Don't Miss Out 3/12 - Classical", sends: 817, opens: 519, openRate: 64.6, mobileOpen: 44.4, desktopOpen: 55.6, clicks: 40, clickRate: 5.0, bounces: 13, bounceRate: 1.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-12 14:07', name: 'FY26 CS8 KYBG - FRIDAY CORRECT', sends: 314, opens: 244, openRate: 78.2, mobileOpen: 52.7, desktopOpen: 47.3, clicks: 57, clickRate: 18.3, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-11 20:00', name: 'FY26 CS8 KYBG - FRIDAY', sends: 314, opens: 167, openRate: 53.5, mobileOpen: 41.2, desktopOpen: 58.8, clicks: 22, clickRate: 7.1, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-10 17:30', name: 'FY26 3/10 Weekly Concert Promo CS10 - Classical Aficionado', sends: 9658, opens: 4342, openRate: 46.1, mobileOpen: 43.0, desktopOpen: 57.0, clicks: 111, clickRate: 1.2, bounces: 233, bounceRate: 2.4, unsubs: 5, unsubRate: 0.1 },
  { date: '2026-03-10 17:30', name: 'FY26 3/10 Weekly Concert Update Final Symphony -- Curious Explorer', sends: 7339, opens: 3575, openRate: 49.2, mobileOpen: 43.0, desktopOpen: 57.0, clicks: 63, clickRate: 0.9, bounces: 72, bounceRate: 1.0, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-03-09 11:59', name: 'FY26 Campaign Events Invite Reminder - MARNY', sends: 38, opens: 28, openRate: 77.8, mobileOpen: 7.5, desktopOpen: 92.5, clicks: 5, clickRate: 13.9, bounces: 2, bounceRate: 5.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-09 11:58', name: 'FY26 Campaign Events Invite Reminder - JEFF', sends: 16, opens: 14, openRate: 93.3, mobileOpen: 38.1, desktopOpen: 61.9, clicks: 2, clickRate: 13.3, bounces: 1, bounceRate: 6.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-09 11:56', name: 'FY26 Campaign Events Invite Reminder - BEBE', sends: 14, opens: 12, openRate: 92.3, mobileOpen: 21.1, desktopOpen: 78.9, clicks: 0, clickRate: 0, bounces: 1, bounceRate: 7.1, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-05 18:00', name: 'FY26 Subscriber Renewal 3/5 - Pops and Family', sends: 684, opens: 397, openRate: 58.3, mobileOpen: 41.3, desktopOpen: 58.7, clicks: 15, clickRate: 2.2, bounces: 3, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-05 18:00', name: 'FY26 Subscriber Renewal 3/5 - Classical', sends: 1144, opens: 700, openRate: 61.8, mobileOpen: 30.8, desktopOpen: 69.2, clicks: 25, clickRate: 2.2, bounces: 11, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-03-03 18:00', name: 'FY26 3/3 Weekly Concert Update -- Curious Explorer', sends: 7329, opens: 3652, openRate: 50.3, mobileOpen: 46.7, desktopOpen: 53.3, clicks: 57, clickRate: 0.8, bounces: 67, bounceRate: 0.9, unsubs: 2, unsubRate: 0.1 },
  { date: '2026-03-03 18:00', name: 'FY26 3/3 Weekly Concert Promo CS8 - Classical Aficionado', sends: 9657, opens: 4543, openRate: 48.2, mobileOpen: 44.3, desktopOpen: 55.7, clicks: 148, clickRate: 1.6, bounces: 230, bounceRate: 2.4, unsubs: 3, unsubRate: 0.1 },
  { date: '2026-02-27 14:01', name: 'FY26 Philharmonia Fantastique KYBG', sends: 167, opens: 126, openRate: 75.9, mobileOpen: 45.8, desktopOpen: 54.2, clicks: 31, clickRate: 18.7, bounces: 1, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-26 19:00', name: 'FY26 Subscriber Renewal 2/26', sends: 1553, opens: 1010, openRate: 65.6, mobileOpen: 24.1, desktopOpen: 75.9, clicks: 91, clickRate: 5.9, bounces: 13, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-24 13:11', name: 'FY26 2/24 Weekly Concert Promo', sends: 97492, opens: 35235, openRate: 37.6, mobileOpen: 29.0, desktopOpen: 71.0, clicks: 383, clickRate: 0.4, bounces: 3788, bounceRate: 3.9, unsubs: 38, unsubRate: 0.1 },
  { date: '2026-02-21 14:00', name: 'FY26 Harry Potter KYBG - SUNDAY', sends: 328, opens: 230, openRate: 70.8, mobileOpen: 76.2, desktopOpen: 23.8, clicks: 98, clickRate: 30.2, bounces: 3, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-20 19:00', name: 'FY26 Harry Potter KYBG - SATURDAY', sends: 380, opens: 253, openRate: 66.9, mobileOpen: 83.0, desktopOpen: 17.0, clicks: 104, clickRate: 27.5, bounces: 2, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-19 19:00', name: 'FY26 Harry Potter KYBG - FRIDAY', sends: 402, opens: 263, openRate: 66.1, mobileOpen: 86.3, desktopOpen: 13.7, clicks: 105, clickRate: 26.4, bounces: 4, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-19 14:47', name: 'FY26 Billy Joel/Elton John Standalone #1', sends: 97591, opens: 35649, openRate: 38.0, mobileOpen: 39.2, desktopOpen: 60.8, clicks: 984, clickRate: 1.0, bounces: 3708, bounceRate: 3.8, unsubs: 27, unsubRate: 0.1 },
  { date: '2026-02-18 11:19', name: "FY26 Chairman's Save the Date - BOTH", sends: 19, opens: 15, openRate: 78.9, mobileOpen: 21.4, desktopOpen: 78.6, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-18 11:14', name: "FY26 Chairman's Save the Date - 1 ONLY", sends: 72, opens: 60, openRate: 83.3, mobileOpen: 23.1, desktopOpen: 76.9, clicks: 2, clickRate: 2.8, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-18 10:51', name: 'FY26 Harry Potter KYBG - THURSDAY', sends: 428, opens: 258, openRate: 61.1, mobileOpen: 62.4, desktopOpen: 37.6, clicks: 113, clickRate: 26.8, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-17 20:00', name: 'FY26 2/17 Weekly Concert Promo', sends: 96853, opens: 36108, openRate: 38.8, mobileOpen: 30.7, desktopOpen: 69.3, clicks: 405, clickRate: 0.4, bounces: 3771, bounceRate: 3.9, unsubs: 39, unsubRate: 0.1 },
  { date: '2026-02-13 14:00', name: "FY26 She's Got Soul KYBG - SUNDAY", sends: 293, opens: 130, openRate: 44.8, mobileOpen: 64.2, desktopOpen: 35.8, clicks: 66, clickRate: 22.8, bounces: 3, bounceRate: 1.0, unsubs: 1, unsubRate: 0.3 },
  { date: '2026-02-12 19:00', name: "FY26 She's Got Soul KYBG - SATURDAY", sends: 407, opens: 174, openRate: 43.0, mobileOpen: 81.5, desktopOpen: 18.5, clicks: 83, clickRate: 20.5, bounces: 2, bounceRate: 0.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-12 14:15', name: 'FY26/27 Season Announcement Email #2', sends: 96950, opens: 14079, openRate: 15.1, mobileOpen: 36.4, desktopOpen: 63.6, clicks: 1652, clickRate: 1.8, bounces: 3622, bounceRate: 3.7, unsubs: 36, unsubRate: 0.1 },
  { date: '2026-02-12 12:26', name: "FY26 She's Got Soul KYBG - FRIDAY", sends: 394, opens: 190, openRate: 48.7, mobileOpen: 55.5, desktopOpen: 44.5, clicks: 79, clickRate: 20.3, bounces: 4, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-10 19:00', name: 'FY26 Chris Thile KYBG - THURSDAY', sends: 523, opens: 287, openRate: 55.5, mobileOpen: 78.0, desktopOpen: 22.0, clicks: 179, clickRate: 34.6, bounces: 6, bounceRate: 1.1, unsubs: 1, unsubRate: 0.2 },
  { date: '2026-02-10 10:30', name: 'FY26 2/10 Weekly Concert Promo', sends: 96601, opens: 11385, openRate: 12.2, mobileOpen: 26.5, desktopOpen: 73.5, clicks: 316, clickRate: 0.3, bounces: 3588, bounceRate: 3.7, unsubs: 33, unsubRate: 0.1 },
  { date: '2026-02-06 10:00', name: 'FY26 CS7 KYBG - SUNDAY', sends: 318, opens: 146, openRate: 46.2, mobileOpen: 29.7, desktopOpen: 70.3, clicks: 62, clickRate: 19.6, bounces: 2, bounceRate: 0.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-05 10:00', name: 'FY26 CS7 KYBG - SATURDAY', sends: 275, opens: 115, openRate: 42.1, mobileOpen: 39.4, desktopOpen: 60.6, clicks: 54, clickRate: 19.8, bounces: 2, bounceRate: 0.7, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-05 09:27', name: "FY26 She's Got Soul Standalone #2", sends: 96676, opens: 12170, openRate: 13.1, mobileOpen: 25.4, desktopOpen: 74.6, clicks: 264, clickRate: 0.3, bounces: 3592, bounceRate: 3.7, unsubs: 29, unsubRate: 0.1 },
  { date: '2026-02-05 09:19', name: 'FY26 Sempre Brunch KBYG', sends: 35, opens: 23, openRate: 65.7, mobileOpen: 31.8, desktopOpen: 68.2, clicks: 3, clickRate: 8.6, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-04 16:21', name: 'FY26 On Stage 2 KYBG - THURSDAY', sends: 34, opens: 27, openRate: 81.8, mobileOpen: 59.2, desktopOpen: 40.8, clicks: 15, clickRate: 45.5, bounces: 1, bounceRate: 2.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-04 10:00', name: 'FY26 CS7 KYBG - FRIDAY', sends: 254, opens: 171, openRate: 67.6, mobileOpen: 46.0, desktopOpen: 54.0, clicks: 54, clickRate: 21.3, bounces: 1, bounceRate: 0.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-02-03 12:14', name: 'FY26 2/3 Weekly Concert Promo', sends: 96691, opens: 33359, openRate: 35.8, mobileOpen: 27.5, desktopOpen: 72.5, clicks: 353, clickRate: 0.4, bounces: 3580, bounceRate: 3.7, unsubs: 31, unsubRate: 0.1 },
  { date: '2026-01-30 14:00', name: 'FY26 CS6 KYBG - SUNDAY', sends: 444, opens: 310, openRate: 70.8, mobileOpen: 51.6, desktopOpen: 48.4, clicks: 76, clickRate: 17.4, bounces: 6, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-29 19:00', name: 'FY26 CS6 KYBG - SATURDAY', sends: 418, opens: 274, openRate: 67.3, mobileOpen: 46.7, desktopOpen: 53.3, clicks: 77, clickRate: 18.9, bounces: 11, bounceRate: 2.6, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-29 13:08', name: 'FY26/27 Season Launch Email', sends: 96820, opens: 36064, openRate: 38.7, mobileOpen: 38.0, desktopOpen: 62.0, clicks: 1697, clickRate: 1.8, bounces: 3594, bounceRate: 3.7, unsubs: 35, unsubRate: 0.1 },
  { date: '2026-01-29 12:40', name: 'FY26 CS6 KYBG - FRIDAY', sends: 302, opens: 221, openRate: 74.2, mobileOpen: 46.9, desktopOpen: 53.1, clicks: 64, clickRate: 21.5, bounces: 4, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-28 16:33', name: 'Piano Master Class with Tamara Stefanovich', sends: 2891, opens: 1124, openRate: 42.9, mobileOpen: 17.6, desktopOpen: 82.4, clicks: 52, clickRate: 2.0, bounces: 274, bounceRate: 9.5, unsubs: 1, unsubRate: 0.1 },
  { date: '2026-01-27 14:03', name: 'FY26 1/27 Weekly Concert Promo', sends: 96788, opens: 34822, openRate: 37.4, mobileOpen: 25.5, desktopOpen: 74.5, clicks: 448, clickRate: 0.5, bounces: 3638, bounceRate: 3.8, unsubs: 24, unsubRate: 0.1 },
  { date: '2026-01-26 09:47', name: 'FY26 Season Announcement KBYG', sends: 60, opens: 56, openRate: 93.3, mobileOpen: 45.3, desktopOpen: 54.7, clicks: 6, clickRate: 10.0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-23 19:00', name: 'FY26 Indiana Jones KYBG - SUNDAY', sends: 357, opens: 243, openRate: 69.0, mobileOpen: 63.1, desktopOpen: 36.9, clicks: 80, clickRate: 22.7, bounces: 5, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-23 11:01', name: 'FY26 Philharmonia Fantastique Standalone', sends: 96920, opens: 34564, openRate: 37.0, mobileOpen: 28.6, desktopOpen: 71.4, clicks: 497, clickRate: 0.5, bounces: 3593, bounceRate: 3.7, unsubs: 34, unsubRate: 0.1 },
  { date: '2026-01-22 19:00', name: 'FY26 Indiana Jones KYBG - SATURDAY', sends: 366, opens: 254, openRate: 70.0, mobileOpen: 73.2, desktopOpen: 26.8, clicks: 93, clickRate: 25.6, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-21 19:00', name: 'FY26 Indiana Jones KYBG - FRIDAY', sends: 387, opens: 262, openRate: 68.2, mobileOpen: 71.5, desktopOpen: 28.5, clicks: 107, clickRate: 27.9, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-21 13:14', name: 'FY26 Indiana Jones KYBG - THURSDAY', sends: 421, opens: 288, openRate: 69.1, mobileOpen: 59.8, desktopOpen: 40.2, clicks: 110, clickRate: 26.4, bounces: 4, bounceRate: 1.0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-20 20:00', name: 'FY26 1/20 Weekly Concert Promo', sends: 96353, opens: 35721, openRate: 38.5, mobileOpen: 31.3, desktopOpen: 68.7, clicks: 499, clickRate: 0.5, bounces: 3556, bounceRate: 3.7, unsubs: 40, unsubRate: 0.1 },
  { date: '2026-01-16 20:00', name: 'FY26 CS5 KYBG - SUNDAY', sends: 375, opens: 258, openRate: 69.5, mobileOpen: 63.0, desktopOpen: 37.0, clicks: 66, clickRate: 17.8, bounces: 4, bounceRate: 1.1, unsubs: 1, unsubRate: 0.3 },
  { date: '2026-01-16 10:20', name: 'FY26 Music & The Mind KBYG', sends: 1, opens: 1, openRate: 100.0, mobileOpen: 25.0, desktopOpen: 75.0, clicks: 0, clickRate: 0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-15 19:00', name: 'FY26 CS5 KYBG - SATURDAY', sends: 389, opens: 248, openRate: 64.9, mobileOpen: 46.9, desktopOpen: 53.1, clicks: 67, clickRate: 17.5, bounces: 7, bounceRate: 1.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-15 13:00', name: "FY26 She's Got Soul Standalone #1", sends: 96407, opens: 34351, openRate: 37.0, mobileOpen: 25.6, desktopOpen: 74.4, clicks: 236, clickRate: 0.3, bounces: 3494, bounceRate: 3.6, unsubs: 42, unsubRate: 0.1 },
  { date: '2026-01-14 19:00', name: 'FY26 CS5 KYBG - FRIDAY', sends: 214, opens: 150, openRate: 70.8, mobileOpen: 52.7, desktopOpen: 47.3, clicks: 40, clickRate: 18.9, bounces: 2, bounceRate: 0.9, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-13 14:29', name: 'FY26 1/13 Weekly Concert Promo', sends: 96458, opens: 35225, openRate: 37.9, mobileOpen: 29.0, desktopOpen: 71.0, clicks: 401, clickRate: 0.4, bounces: 3510, bounceRate: 3.6, unsubs: 28, unsubRate: 0.1 },
  { date: '2026-01-12 17:25', name: 'FY26 Piazza Subscription Update - Customer Facing', sends: 373, opens: 293, openRate: 79.6, mobileOpen: 44.9, desktopOpen: 55.1, clicks: 2, clickRate: 0.5, bounces: 5, bounceRate: 1.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-12 10:00', name: 'FY26 Sempre Brunch Invite Reminder', sends: 66, opens: 50, openRate: 76.9, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 10, clickRate: 15.4, bounces: 1, bounceRate: 1.5, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-09 09:30', name: 'FY26 CS4 KYBG - SUNDAY', sends: 399, opens: 260, openRate: 65.7, mobileOpen: 42.9, desktopOpen: 57.1, clicks: 88, clickRate: 22.2, bounces: 3, bounceRate: 0.8, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-08 19:00', name: 'FY26 CS4 KYBG - SATURDAY', sends: 358, opens: 240, openRate: 68.0, mobileOpen: 53.4, desktopOpen: 46.6, clicks: 74, clickRate: 21.0, bounces: 5, bounceRate: 1.4, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-08 14:38', name: 'FY26 On Stage 2 Standalone #1', sends: 96583, opens: 35503, openRate: 38.1, mobileOpen: 30.2, desktopOpen: 69.8, clicks: 267, clickRate: 0.3, bounces: 3467, bounceRate: 3.6, unsubs: 40, unsubRate: 0.1 },
  { date: '2026-01-08 09:48', name: 'FY26 CS4 KYBG - FRIDAY', sends: 359, opens: 240, openRate: 67.0, mobileOpen: 55.9, desktopOpen: 44.1, clicks: 75, clickRate: 20.9, bounces: 1, bounceRate: 0.3, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-06 14:00', name: 'FY26 Season Announcement Invite - Reminder', sends: 201, opens: 142, openRate: 70.6, mobileOpen: 38.9, desktopOpen: 61.1, clicks: 12, clickRate: 6.0, bounces: 0, bounceRate: 0, unsubs: 0, unsubRate: 0 },
  { date: '2026-01-06 11:39', name: 'FY26 1/6 Weekly Concert Promo', sends: 96485, opens: 34861, openRate: 37.5, mobileOpen: 24.4, desktopOpen: 75.6, clicks: 395, clickRate: 0.4, bounces: 3495, bounceRate: 3.6, unsubs: 34, unsubRate: 0.1 },
  { date: '2026-01-01 09:00', name: 'FY26 Indiana Jones Standalone #1', sends: 96612, opens: 35202, openRate: 37.8, mobileOpen: 31.0, desktopOpen: 69.0, clicks: 529, clickRate: 0.6, bounces: 3507, bounceRate: 3.6, unsubs: 35, unsubRate: 0.1 },
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
      <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0;">${s.periodLabel} · vs. previous 141 days</p>
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
        <div class="kpi-bottom"><span class="kpi-value">${(s.clickRate * 100).toFixed(0)}%</span><span class="kpi-badge flat">3% CTO</span></div>
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
      <p class="card-subtitle">${campaigns.length} campaigns · Click column headers to sort</p>
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
