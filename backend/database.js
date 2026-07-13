const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbPath = path.resolve(__dirname, 'database.json');

// Local in-memory store that syncs to database.json
let data = {
  users: [],
  poles: [],
  complaints: [],
  complaint_status_log: [],
  maintenance_schedule: [],
  vendors: []
};

// Load data from file
function loadDatabase() {
  try {
    if (fs.existsSync(dbPath)) {
      const fileData = fs.readFileSync(dbPath, 'utf8');
      data = JSON.parse(fileData);
      console.log('Database loaded successfully from:', dbPath);
    } else {
      console.log('No database file found. Initializing empty tables.');
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading database:', err.message);
  }
}

// Save data to file
function saveDatabase() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving database:', err.message);
  }
}

// Database helper simulation
const db = {
  run: (sql, params, cb) => cb(null),
  get: (sql, params, cb) => cb(null, {}),
  all: (sql, params, cb) => cb(null, [])
};

// Dispatch SQL query calls to JS functions
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const sqlLower = sql.toLowerCase().trim();
      let lastID = 0;
      let changes = 0;

      // 1. INSERT INTO users
      if (sqlLower.startsWith('insert into users')) {
        const [username, name, password_hash, role, phone] = params;
        const newId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
        const newUser = { id: newId, username, name, password_hash, role, phone };
        data.users.push(newUser);
        lastID = newId;
        changes = 1;
      }
      // 2. INSERT INTO vendors
      else if (sqlLower.startsWith('insert into vendors')) {
        const [user_id, company_name, assigned_sections, specialization] = params;
        // Delete existing vendor profile if any (UPSERT style)
        data.vendors = data.vendors.filter(v => v.user_id !== user_id);
        data.vendors.push({ user_id, company_name, assigned_sections, specialization });
        changes = 1;
      }
      // 3. INSERT INTO poles
      else if (sqlLower.startsWith('insert into poles')) {
        const [pole_id, section_name, latitude, longitude, last_inspection_date] = params;
        data.poles.push({ pole_id, section_name, latitude, longitude, last_inspection_date });
        changes = 1;
      }
      // 4. INSERT INTO complaints
      else if (sqlLower.startsWith('insert into complaints')) {
        const [id, pole_id, reported_by, severity, category, media_url, description, status, is_public, is_moderated] = params;
        data.complaints.push({
          id,
          pole_id,
          reported_by,
          severity,
          category,
          media_url,
          description,
          status,
          assigned_vendor_id: null,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
          updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
          is_public,
          is_moderated
        });
        lastID = id;
        changes = 1;
      }
      // 5. INSERT INTO complaint_status_log
      else if (sqlLower.startsWith('insert into complaint_status_log')) {
        const [complaint_id, changed_by, from_status, to_status, notes] = params;
        const newLogId = data.complaint_status_log.length > 0 ? Math.max(...data.complaint_status_log.map(l => l.id)) + 1 : 1;
        data.complaint_status_log.push({
          id: newLogId,
          complaint_id,
          changed_by,
          from_status,
          to_status,
          notes,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
        lastID = newLogId;
        changes = 1;
      }
      // 6. INSERT INTO maintenance_schedule
      else if (sqlLower.startsWith('insert into maintenance_schedule')) {
        const [section_name, pole_id, assigned_staff_id, due_date, status, notes] = params;
        const newSchedId = data.maintenance_schedule.length > 0 ? Math.max(...data.maintenance_schedule.map(m => m.id)) + 1 : 1;
        data.maintenance_schedule.push({
          id: newSchedId,
          section_name,
          pole_id,
          assigned_staff_id,
          due_date,
          status,
          completed_date: null,
          notes
        });
        lastID = newSchedId;
        changes = 1;
      }
      // 7. UPDATE complaints (status, vendor)
      else if (sqlLower.startsWith('update complaints')) {
        if (sqlLower.includes('set status = ?, assigned_vendor_id = ?')) {
          const [status, assigned_vendor_id, id] = params;
          const complaint = data.complaints.find(c => c.id === id);
          if (complaint) {
            complaint.status = status;
            complaint.assigned_vendor_id = assigned_vendor_id;
            complaint.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
            changes = 1;
          }
        } else if (sqlLower.includes('set is_moderated = 1')) {
          const [id] = params;
          const complaint = data.complaints.find(c => c.id === id);
          if (complaint) {
            complaint.is_moderated = 1;
            complaint.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
            changes = 1;
          }
        } else if (sqlLower.includes("set status = 'closed', is_moderated = 1")) {
          const [id] = params;
          const complaint = data.complaints.find(c => c.id === id);
          if (complaint) {
            complaint.status = 'Closed';
            complaint.is_moderated = 1;
            complaint.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
            changes = 1;
          }
        }
      }
      // 8. UPDATE maintenance_schedule
      else if (sqlLower.startsWith('update maintenance_schedule')) {
        const [status, completed_date, notes, id] = params;
        const task = data.maintenance_schedule.find(m => m.id === parseInt(id));
        if (task) {
          task.status = status;
          task.completed_date = completed_date;
          task.notes = notes;
          changes = 1;
        }
      }
      // 9. UPDATE poles last_inspection_date
      else if (sqlLower.startsWith('update poles')) {
        const [last_inspection_date, pole_id] = params;
        const pole = data.poles.find(p => p.pole_id === pole_id);
        if (pole) {
          pole.last_inspection_date = last_inspection_date;
          changes = 1;
        }
      }

      if (changes > 0) {
        saveDatabase();
      }

      resolve({ lastID, changes });
    } catch (err) {
      reject(err);
    }
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const sqlLower = sql.toLowerCase().trim();

      // 1. SELECT * FROM users WHERE username = ?
      if (sqlLower.startsWith('select * from users where username = ?')) {
        const username = params[0];
        const user = data.users.find(u => u.username === username);
        resolve(user || null);
      }
      // 2. SELECT id FROM users WHERE username = ?
      else if (sqlLower.startsWith('select id from users where username = ?')) {
        const username = params[0];
        const user = data.users.find(u => u.username === username);
        resolve(user ? { id: user.id } : null);
      }
      // 3. SELECT id FROM users WHERE role = 'vendor' / 'lineman' etc.
      else if (sqlLower.startsWith("select id from users where username = 'emp003'")) {
        const user = data.users.find(u => u.username === 'EMP003');
        resolve(user ? { id: user.id } : null);
      }
      else if (sqlLower.startsWith("select id from users where username = 'emp002'")) {
        const user = data.users.find(u => u.username === 'EMP002');
        resolve(user ? { id: user.id } : null);
      }
      // 4. SELECT * FROM poles WHERE pole_id = ?
      else if (sqlLower.startsWith('select * from poles where pole_id = ?')) {
        const poleId = params[0];
        const pole = data.poles.find(p => p.pole_id === poleId);
        resolve(pole || null);
      }
      // 5. SELECT pole_id FROM poles WHERE pole_id = ?
      else if (sqlLower.startsWith('select pole_id from poles where pole_id = ?')) {
        const poleId = params[0];
        const pole = data.poles.find(p => p.pole_id === poleId);
        resolve(pole ? { pole_id: pole.pole_id } : null);
      }
      // 6. SELECT count(*) as count FROM users
      else if (sqlLower.startsWith('select count(*) as count from users')) {
        resolve({ count: data.users.length });
      }
      // 7. SELECT * FROM complaints WHERE id = ?
      else if (sqlLower.startsWith('select * from complaints where id = ?')) {
        const id = params[0];
        const complaint = data.complaints.find(c => c.id === id);
        resolve(complaint || null);
      }
      // 8. SELECT * FROM maintenance_schedule WHERE id = ?
      else if (sqlLower.startsWith('select * from maintenance_schedule where id = ?')) {
        const id = params[0];
        const task = data.maintenance_schedule.find(m => m.id === parseInt(id));
        resolve(task || null);
      }
      else {
        resolve(null);
      }
    } catch (err) {
      reject(err);
    }
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const sqlLower = sql.toLowerCase().trim();

      // 1. SELECT * FROM poles
      if (sqlLower.startsWith('select * from poles')) {
        resolve(data.poles);
      }
      // 2. Open complaints for pole QR view
      else if (sqlLower.includes("where c.pole_id = ? and c.status != 'closed' and c.status != 'resolved'")) {
        const poleId = params[0];
        const poleComplaints = data.complaints.filter(
          c => c.pole_id === poleId && c.status !== 'Closed' && c.status !== 'Resolved'
        );
        const mapped = poleComplaints.map(c => {
          const reporter = data.users.find(u => u.id === c.reported_by);
          return { ...c, reporter_name: reporter ? reporter.name : 'Public / Commuter' };
        });
        resolve(mapped);
      }
      // 3. Search and filter complaints
      else if (sqlLower.includes('from complaints c') && sqlLower.includes('join poles p')) {
        // Parse simulated filters
        // For simplicity, filter based on exact matches on backend/server.js parameters.
        // The parameters are passed dynamically.
        // We will match the shape:
        // params: [sectionName, severity, status, is_public, is_moderated]
        // Let's filter manually:
        let list = data.complaints.map(c => {
          const pole = data.poles.find(p => p.pole_id === c.pole_id) || {};
          const reporter = data.users.find(u => u.id === c.reported_by);
          const vendorUser = data.users.find(u => u.id === c.assigned_vendor_id);
          const vendorMeta = data.vendors.find(v => v.user_id === c.assigned_vendor_id);
          return {
            ...c,
            section_name: pole.section_name || 'Unknown',
            latitude: pole.latitude || 0,
            longitude: pole.longitude || 0,
            reporter_name: reporter ? reporter.name : 'Public / Commuter',
            vendor_name: vendorUser ? vendorUser.name : null,
            company_name: vendorMeta ? vendorMeta.company_name : null
          };
        });

        // Let's check parameters dynamically by searching SQL filters.
        // We will simulate parameter matching based on SQL condition matching.
        let paramIndex = 0;
        if (sql.includes('p.section_name = ?')) {
          const sec = params[paramIndex++];
          list = list.filter(item => item.section_name.toLowerCase() === sec.toLowerCase());
        }
        if (sql.includes('c.severity = ?')) {
          const sev = params[paramIndex++];
          list = list.filter(item => item.severity === sev);
        }
        if (sql.includes('c.status = ?')) {
          const stat = params[paramIndex++];
          list = list.filter(item => item.status === stat);
        }
        if (sql.includes('c.is_public = ?')) {
          const pub = params[paramIndex++];
          list = list.filter(item => item.is_public === pub);
        }
        if (sql.includes('c.is_moderated = ?')) {
          const mod = params[paramIndex++];
          list = list.filter(item => item.is_moderated === mod);
        }

        resolve(list);
      }
      // 4. Status log / History
      else if (sqlLower.startsWith('select l.*, u.name as user_name')) {
        const id = params[0];
        const logs = data.complaint_status_log.filter(l => l.complaint_id === id);
        const mapped = logs.map(l => {
          const user = data.users.find(u => u.id === l.changed_by);
          return {
            ...l,
            user_name: user ? user.name : 'System / Public',
            user_role: user ? user.role : 'public'
          };
        });
        resolve(mapped);
      }
      // 5. Maintenance schedule
      else if (sqlLower.includes('from maintenance_schedule m')) {
        const list = data.maintenance_schedule.map(m => {
          const pole = data.poles.find(p => p.pole_id === m.pole_id) || {};
          const staff = data.users.find(u => u.id === m.assigned_staff_id);
          return {
            ...m,
            staff_name: staff ? staff.name : 'Unassigned',
            section_name: pole.section_name || 'Unknown',
            latitude: pole.latitude || 0,
            longitude: pole.longitude || 0
          };
        });
        resolve(list);
      }
      // 6. Vendor Module
      else if (sqlLower.includes('from users u join vendors v')) {
        const list = data.vendors.map(v => {
          const u = data.users.find(usr => usr.id === v.user_id) || {};
          return {
            user_id: v.user_id,
            name: u.name,
            phone: u.phone,
            employee_id: u.username,
            company_name: v.company_name,
            assigned_sections: v.assigned_sections,
            specialization: v.specialization
          };
        });
        resolve(list);
      }
      // 7. General Selects
      else if (sqlLower.includes('from users where role =')) {
        const roleMatch = sqlLower.match(/role = '(\w+)'/);
        if (roleMatch) {
          resolve(data.users.filter(u => u.role === roleMatch[1]));
        } else {
          resolve([]);
        }
      }
      else {
        resolve([]);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Initialize and seed function
async function seedData() {
  try {
    if (data.users.length > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    console.log('Seeding initial data into JSON file...');

    const saltRounds = 10;
    const adminHash = await bcrypt.hash('admin123', saltRounds);
    const supervisorHash = await bcrypt.hash('supervisor123', saltRounds);
    const lineman1Hash = await bcrypt.hash('lineman123', saltRounds);
    const lineman2Hash = await bcrypt.hash('lineman456', saltRounds);
    const secEngineerHash = await bcrypt.hash('engineer123', saltRounds);
    const vendorHash1 = await bcrypt.hash('vendor123', saltRounds);
    const vendorHash2 = await bcrypt.hash('vendor456', saltRounds);

    data.users = [
      { id: 1, username: 'EMP001', name: 'Rajesh Sharma', password_hash: adminHash, role: 'admin', phone: '+919876543210' },
      { id: 2, username: 'EMP002', name: 'Sanjay Kumar', password_hash: supervisorHash, role: 'supervisor', phone: '+919876543211' },
      { id: 3, username: 'EMP003', name: 'Amit Patel', password_hash: lineman1Hash, role: 'lineman', phone: '+919876543212' },
      { id: 4, username: 'EMP004', name: 'Vikram Singh', password_hash: lineman2Hash, role: 'lineman', phone: '+919876543213' },
      { id: 5, username: 'EMP005', name: 'Deepika Rao', password_hash: secEngineerHash, role: 'section_engineer', phone: '+919876543214' },
      { id: 6, username: 'VND001', name: 'TrackForce Ltd Vendor', password_hash: vendorHash1, role: 'vendor', phone: '+919876543215' },
      { id: 7, username: 'VND002', name: 'RailSignal Corp Vendor', password_hash: vendorHash2, role: 'vendor', phone: '+919876543216' },
    ];

    data.vendors = [
      { user_id: 6, company_name: 'TrackForce Ltd', assigned_sections: 'Section 12,Section 14', specialization: 'Track Fracture & Structural Repairs' },
      { user_id: 7, company_name: 'RailSignal Corp', assigned_sections: 'Section 12,Section 15', specialization: 'Signal Faults & Wiring Diagnostics' }
    ];

    data.poles = [
      { pole_id: 'POLE-SEC12-0045', section_name: 'Section 12', latitude: 19.0760, longitude: 72.8777, last_inspection_date: '2026-06-15' },
      { pole_id: 'POLE-SEC12-0046', section_name: 'Section 12', latitude: 19.0780, longitude: 72.8795, last_inspection_date: '2026-07-01' },
      { pole_id: 'POLE-SEC12-0047', section_name: 'Section 12', latitude: 19.0800, longitude: 72.8812, last_inspection_date: '2026-05-10' }, // Overdue
      { pole_id: 'POLE-SEC15-0101', section_name: 'Section 15', latitude: 19.1120, longitude: 72.9022, last_inspection_date: '2026-07-05' },
      { pole_id: 'POLE-SEC15-0102', section_name: 'Section 15', latitude: 19.1150, longitude: 72.9055, last_inspection_date: '2026-04-20' }, // Overdue
    ];

    data.complaints = [
      {
        id: 'COMP-72941',
        pole_id: 'POLE-SEC12-0047',
        reported_by: 3, // Amit Patel (Lineman)
        severity: 'Critical',
        category: 'Track Fracture',
        media_url: '',
        description: 'Severe vertical cracking observed on track joint near Pole 0047. Needs immediate action.',
        status: 'Assigned',
        assigned_vendor_id: 6,
        created_at: '2026-07-08 10:15:30',
        updated_at: '2026-07-08 12:30:00',
        is_public: 0,
        is_moderated: 1
      },
      {
        id: 'COMP-18349',
        pole_id: 'POLE-SEC15-0102',
        reported_by: null, // Public
        severity: 'Major',
        category: 'Vegetation',
        media_url: '',
        description: 'Large bush blocking the visual line of signal pole. Commuter reported.',
        status: 'Raised',
        assigned_vendor_id: null,
        created_at: '2026-07-09 08:22:00',
        updated_at: '2026-07-09 08:22:00',
        is_public: 1,
        is_moderated: 0 // Needs moderation
      },
      {
        id: 'COMP-92384',
        pole_id: 'POLE-SEC12-0045',
        reported_by: 3,
        severity: 'Routine',
        category: 'Pole Damage',
        media_url: '',
        description: 'Base of QR code pole shows light rusting, paint peeling off.',
        status: 'Resolved',
        assigned_vendor_id: null,
        created_at: '2026-07-05 14:00:00',
        updated_at: '2026-07-07 16:45:00',
        is_public: 0,
        is_moderated: 1
      }
    ];

    data.complaint_status_log = [
      { id: 1, complaint_id: 'COMP-72941', changed_by: 3, from_status: 'None', to_status: 'Raised', notes: 'Complaint registered', timestamp: '2026-07-08 10:15:30' },
      { id: 2, complaint_id: 'COMP-72941', changed_by: 2, from_status: 'Raised', to_status: 'Assigned', notes: 'Assigned to TrackForce Ltd for urgent joint welding', timestamp: '2026-07-08 12:30:00' },
      { id: 3, complaint_id: 'COMP-18349', changed_by: null, from_status: 'None', to_status: 'Raised', notes: 'Commuter report submitted', timestamp: '2026-07-09 08:22:00' },
      { id: 4, complaint_id: 'COMP-92384', changed_by: 3, from_status: 'None', to_status: 'Raised', notes: 'Routine checkup logged', timestamp: '2026-07-05 14:00:00' },
      { id: 5, complaint_id: 'COMP-92384', changed_by: 3, from_status: 'Raised', to_status: 'Resolved', notes: 'Polished rust and applied protective coating', timestamp: '2026-07-07 16:45:00' }
    ];

    data.maintenance_schedule = [
      { id: 1, section_name: 'Section 12', pole_id: 'POLE-SEC12-0045', assigned_staff_id: 3, due_date: '2026-07-20', status: 'Pending', completed_date: null, notes: '' },
      { id: 2, section_name: 'Section 12', pole_id: 'POLE-SEC12-0047', assigned_staff_id: 3, due_date: '2026-07-05', status: 'Pending', completed_date: null, notes: 'Overdue inspection' },
      { id: 3, section_name: 'Section 15', pole_id: 'POLE-SEC15-0102', assigned_staff_id: 3, due_date: '2026-07-08', status: 'Pending', completed_date: null, notes: 'Vegetation inspection' },
    ];

    saveDatabase();
    console.log('Seeding finished successfully.');
  } catch (err) {
    console.error('Error seeding data:', err.message);
  }
}

// Initial boot
loadDatabase();
seedData();

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery
};
