import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

function localEmbed(text: string): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/).filter(Boolean);
  const vector = new Float64Array(768);
  for (const word of words) {
    const hash = createHash('sha256').update(word).digest();
    for (let i = 0; i < 768; i++) {
      vector[i] += (hash[i % hash.length]! / 255) * 2 - 1;
    }
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) for (let i = 0; i < 768; i++) vector[i] = vector[i]! / magnitude;
  return Array.from(vector);
}

const CAMPUS_CENTER = [77.5946, 12.9716]; // Bangalore area coordinates
const SPREAD = 0.008;

function randomLocation(): { type: 'Point'; coordinates: [number, number] } {
  return {
    type: 'Point',
    coordinates: [
      CAMPUS_CENTER[0]! + (Math.random() - 0.5) * SPREAD * 2,
      CAMPUS_CENTER[1]! + (Math.random() - 0.5) * SPREAD * 2,
    ],
  };
}

const categories = ['infrastructure', 'electrical', 'plumbing', 'cleanliness', 'network', 'safety', 'other'] as const;
const statuses = ['open', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
const priorities = ['low', 'medium', 'high', 'critical'] as const;

const ISSUE_TEMPLATES = [
  { cat: 'infrastructure', titles: ['Pothole near main gate', 'Broken bench in park area', 'Cracked pavement on walkway', 'Damaged railing on stairs', 'Collapsed retaining wall'] },
  { cat: 'electrical', titles: ['Streetlight not working', 'Exposed wiring in corridor', 'Flickering lights in library', 'Power outlet sparking', 'Emergency light dead'] },
  { cat: 'plumbing', titles: ['Water leak in washroom', 'Clogged drain near cafeteria', 'Broken water fountain', 'Leaking pipe in basement', 'Low water pressure in Block C'] },
  { cat: 'cleanliness', titles: ['Overflowing dustbin outside canteen', 'Dirty washroom in Block A', 'Graffiti on building wall', 'Littering near sports ground', 'Stagnant water breeding mosquitoes'] },
  { cat: 'network', titles: ['WiFi outage in library', 'Slow internet in hostel', 'No connectivity in lab 3', 'Router down in seminar hall', 'Network drops during peak hours'] },
  { cat: 'safety', titles: ['Missing fire extinguisher', 'Broken CCTV camera', 'Unlit parking area', 'Loose ceiling tile', 'Slippery floor no warning sign'] },
  { cat: 'other', titles: ['AC not working in auditorium', 'Elevator stuck frequently', 'Noisy generator near classes', 'Faded road markings', 'Missing signage at entrance'] },
];

const DESCRIPTIONS: Record<string, string[]> = {
  infrastructure: [
    'Large pothole causing vehicles to swerve. Risk of accidents. Needs immediate filling.',
    'The bench is broken and has sharp edges. Students could get injured.',
    'Pavement cracked and uneven. Wheelchair users and elderly have difficulty.',
    'The railing on the south staircase is loose and wobbling dangerously.',
    'Part of the retaining wall has collapsed after recent rains.',
  ],
  electrical: [
    'The streetlight has been off for over a week. Area is very dark at night.',
    'Wires are exposed near the junction box. Very dangerous for students passing by.',
    'Lights in the reading section keep flickering. Causes headaches and eye strain.',
    'Sparks visible when plugging in devices. Burnt smell coming from the outlet.',
    'Emergency exit light is not functioning. Violation of safety protocols.',
  ],
  plumbing: [
    'Water is leaking from the ceiling in the ground floor washroom. Floor is always wet.',
    'The drain near the cafeteria is completely clogged. Water overflows when it rains.',
    'Water fountain on second floor is broken. No drinking water available on this floor.',
    'Pipe burst in the basement, water accumulating rapidly.',
    'Water pressure too low in Block C. Cannot use sinks or toilets properly.',
  ],
  cleanliness: [
    'Dustbin has been overflowing for 3 days. Attracts stray animals and insects.',
    'Washroom has not been cleaned in days. Unbearable smell and unsanitary conditions.',
    'Someone spray-painted graffiti all over the south wall of the science building.',
    'Lots of litter and food waste scattered around the sports ground after the event.',
    'Stagnant water near Block B is breeding mosquitoes. Students getting sick.',
  ],
  network: [
    'WiFi is completely down in the library since this morning. Students cannot study.',
    'Internet speed in the hostel drops below 1 Mbps during evening hours.',
    'No network connectivity at all in Computer Lab 3. Classes are affected.',
    'The router in the seminar hall crashed during a presentation.',
    'Network keeps disconnecting every few minutes. Very frustrating.',
  ],
  safety: [
    'Fire extinguisher is missing from the holder near the chemistry lab.',
    'CCTV camera at the east entrance has been broken for weeks.',
    'Parking area behind Block D has no lights. Feels unsafe at night.',
    'Ceiling tile in the corridor is hanging loose and could fall on someone.',
    'Floor is slippery after mopping but no wet floor sign was placed.',
  ],
  other: [
    'Air conditioning in the main auditorium has not been working for a week.',
    'The elevator gets stuck between floors at least twice a day.',
    'Generator noise is very loud and disrupts classes in nearby rooms.',
    'Road markings in the parking lot are so faded that nobody follows lanes.',
    'There is no signage at the new entrance. Visitors cannot find their way.',
  ],
};

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log('Connected. Seeding database...');

  // Clear existing data
  await Promise.all([
    db.collection('departments').deleteMany({}),
    db.collection('users').deleteMany({}),
    db.collection('issues').deleteMany({}),
    db.collection('issue_events').deleteMany({}),
  ]);

  // Seed departments
  const deptData = [
    { name: 'Maintenance', slug: 'maintenance', description: 'General campus maintenance and infrastructure', activeIssues: 0, resolvedIssues: 0, members: [] },
    { name: 'IT Services', slug: 'it-services', description: 'Network, WiFi, and technology support', activeIssues: 0, resolvedIssues: 0, members: [] },
    { name: 'Electrical', slug: 'electrical', description: 'Electrical systems and lighting', activeIssues: 0, resolvedIssues: 0, members: [] },
    { name: 'Plumbing', slug: 'plumbing', description: 'Water supply and drainage systems', activeIssues: 0, resolvedIssues: 0, members: [] },
    { name: 'Housekeeping', slug: 'housekeeping', description: 'Cleaning and sanitation services', activeIssues: 0, resolvedIssues: 0, members: [] },
  ];
  const deptResult = await db.collection('departments').insertMany(deptData);
  const deptIds = Object.values(deptResult.insertedIds).map((id) => id.toString());
  console.log(`Inserted ${deptIds.length} departments`);

  // Seed users
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const studentHash = await bcrypt.hash('Student@123', 12);

  const usersData = [
    { name: 'Admin User', email: 'admin@fixmycampus.dev', passwordHash, role: 'admin', createdAt: new Date() },
    { name: 'Rahul Sharma', email: 'rahul@campus.edu', passwordHash: studentHash, role: 'citizen', createdAt: new Date() },
    { name: 'Priya Patel', email: 'priya@campus.edu', passwordHash: studentHash, role: 'citizen', createdAt: new Date() },
    { name: 'Amit Kumar', email: 'amit@campus.edu', passwordHash: studentHash, role: 'citizen', createdAt: new Date() },
    { name: 'Sneha Gupta', email: 'sneha@campus.edu', passwordHash: studentHash, role: 'citizen', createdAt: new Date() },
    { name: 'Vikram Singh', email: 'vikram@campus.edu', passwordHash: studentHash, role: 'citizen', createdAt: new Date() },
    { name: 'Dept Head - Maintenance', email: 'maintenance@fixmycampus.dev', passwordHash, role: 'department_head', department: deptIds[0], createdAt: new Date() },
  ];
  const userResult = await db.collection('users').insertMany(usersData);
  const userIds = Object.values(userResult.insertedIds).map((id) => id.toString());
  console.log(`Inserted ${userIds.length} users`);

  // Category to department mapping
  const catToDept: Record<string, string> = {
    infrastructure: deptIds[0]!,
    electrical: deptIds[2]!,
    plumbing: deptIds[3]!,
    cleanliness: deptIds[4]!,
    network: deptIds[1]!,
    safety: deptIds[0]!,
    other: deptIds[0]!,
  };

  // Seed issues
  const issues: any[] = [];
  const events: any[] = [];
  const now = Date.now();

  for (const template of ISSUE_TEMPLATES) {
    const descs = DESCRIPTIONS[template.cat]!;
    for (let i = 0; i < template.titles.length; i++) {
      const title = template.titles[i]!;
      const description = descs[i]!;
      const statusIdx = Math.floor(Math.random() * statuses.length);
      const status = statuses[statusIdx]!;
      const priority = priorities[Math.floor(Math.random() * priorities.length)]!;
      const reporterIdx = 1 + Math.floor(Math.random() * 5); // skip admin
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      const issueId = new ObjectId();

      const issue: any = {
        _id: issueId,
        title,
        description,
        category: template.cat,
        status,
        priority,
        location: randomLocation(),
        reportedBy: userIds[reporterIdx]!,
        reporterName: usersData[reporterIdx]!.name,
        upvotes: [],
        upvoteCount: Math.floor(Math.random() * 20),
        comments: [],
        statusHistory: [],
        embedding: localEmbed(`${title} ${description}`),
        createdAt,
        updatedAt: createdAt,
      };

      // Add assignment for assigned/in_progress/resolved/closed
      if (statusIdx >= 1) {
        issue.assignedDepartment = catToDept[template.cat];
        issue.statusHistory.push({
          from: 'open',
          to: 'assigned',
          changedBy: userIds[0],
          changedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
        });
      }

      if (statusIdx >= 3) {
        issue.resolvedAt = new Date(createdAt.getTime() + (12 + Math.random() * 72) * 60 * 60 * 1000);
        issue.statusHistory.push({
          from: 'in_progress',
          to: 'resolved',
          changedBy: userIds[0],
          changedAt: issue.resolvedAt,
        });
      }

      issues.push(issue);

      events.push({
        timestamp: createdAt,
        metadata: { issueId: issueId.toString(), type: 'created', userId: userIds[reporterIdx] },
        category: template.cat,
      });

      if (statusIdx >= 1) {
        events.push({
          timestamp: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
          metadata: { issueId: issueId.toString(), type: 'assigned', userId: userIds[0] },
          category: template.cat,
        });
      }

      if (statusIdx >= 3) {
        events.push({
          timestamp: issue.resolvedAt,
          metadata: { issueId: issueId.toString(), type: 'resolved', userId: userIds[0] },
          category: template.cat,
        });
      }
    }
  }

  // Add extra random issues to reach ~150
  const extraCount = 150 - issues.length;
  for (let i = 0; i < extraCount; i++) {
    const catIdx = Math.floor(Math.random() * categories.length);
    const cat = categories[catIdx]!;
    const templateGroup = ISSUE_TEMPLATES.find((t) => t.cat === cat)!;
    const titleIdx = Math.floor(Math.random() * templateGroup.titles.length);
    const title = `${templateGroup.titles[titleIdx]} (#${i + 1})`;
    const description = DESCRIPTIONS[cat]![titleIdx]!;
    const status = statuses[Math.floor(Math.random() * 3)]!; // mostly open/assigned/in_progress
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const reporterIdx = 1 + Math.floor(Math.random() * 5);
    const issueId = new ObjectId();

    issues.push({
      _id: issueId,
      title,
      description,
      category: cat,
      status,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      location: randomLocation(),
      reportedBy: userIds[reporterIdx]!,
      reporterName: usersData[reporterIdx]!.name,
      upvotes: [],
      upvoteCount: Math.floor(Math.random() * 10),
      comments: [],
      statusHistory: [],
      embedding: localEmbed(`${title} ${description}`),
      createdAt,
      updatedAt: createdAt,
    });

    events.push({
      timestamp: createdAt,
      metadata: { issueId: issueId.toString(), type: 'created', userId: userIds[reporterIdx] },
      category: cat,
    });
  }

  await db.collection('issues').insertMany(issues);
  console.log(`Inserted ${issues.length} issues`);

  await db.collection('issue_events').insertMany(events);
  console.log(`Inserted ${events.length} issue events`);

  // Update department active issue counts
  for (const [cat, deptId] of Object.entries(catToDept)) {
    const count = issues.filter(
      (i) => i.category === cat && ['assigned', 'in_progress'].includes(i.status)
    ).length;
    if (count > 0) {
      await db.collection('departments').updateOne(
        { _id: new ObjectId(deptId) },
        { $inc: { activeIssues: count } }
      );
    }
  }

  console.log('Seeding complete!');
  console.log('Login as admin: admin@fixmycampus.dev / Admin@123');
  await client.close();
}

seed().catch(console.error);
