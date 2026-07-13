const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
require('dotenv').config();

const { db, runQuery, getQuery, allQuery } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'railtrack_jwt_secret_default_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer Storage for Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper to generate IDs
function generateComplaintId() {
  return 'COMP-' + Math.floor(10000 + Math.random() * 90000);
}

// Authentication Middlewares
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }
    next();
  };
}

// --- API ROUTES ---

// 1. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid Employee ID/Username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Employee ID/Username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// Auth: Me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Auth: Register (Admin only)
app.post('/api/auth/register', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { username, name, password, role, phone } = req.body;

  if (!username || !name || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await getQuery('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username/Employee ID already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await runQuery(
      'INSERT INTO users (username, name, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [username, name, hash, role, phone]
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 2. File Upload Utility
app.post('/api/uploads', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const relativePath = `/uploads/${req.file.filename}`;
  res.json({ mediaUrl: relativePath });
});

// 3. Poles: Get All (with filter/search)
app.get('/api/poles', authenticateToken, async (req, res) => {
  try {
    const poles = await allQuery('SELECT * FROM poles');
    res.json(poles);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Poles: Get single (QR lookup)
app.get('/api/poles/:poleId', async (req, res) => {
  const { poleId } = req.params;
  try {
    const pole = await getQuery('SELECT * FROM poles WHERE pole_id = ?', [poleId]);
    if (!pole) {
      return res.status(404).json({ error: 'Track section/pole not found' });
    }

    // Fetch open complaints for this pole
    const complaints = await allQuery(
      `SELECT c.*, u.name as reporter_name 
       FROM complaints c 
       LEFT JOIN users u ON c.reported_by = u.id 
       WHERE c.pole_id = ? AND c.status != 'Closed' AND c.status != 'Resolved'`,
      [poleId]
    );

    res.json({ pole, openComplaints: complaints });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Poles: Register / Add new pole (Admin tool)
app.post('/api/poles', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { poleId, sectionName, latitude, longitude } = req.body;

  if (!poleId || !sectionName || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await getQuery('SELECT pole_id FROM poles WHERE pole_id = ?', [poleId]);
    if (existing) {
      return res.status(400).json({ error: 'Pole ID already exists' });
    }

    await runQuery(
      'INSERT INTO poles (pole_id, section_name, latitude, longitude, last_inspection_date) VALUES (?, ?, ?, ?, ?)',
      [poleId, sectionName, parseFloat(latitude), parseFloat(longitude), new Date().toISOString().split('T')[0]]
    );

    res.status(201).json({ message: 'Pole registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 4. Complaints: List & Filter
app.get('/api/complaints', authenticateToken, async (req, res) => {
  const { section, severity, status, is_public, is_moderated } = req.query;
  let sql = `
    SELECT c.*, p.section_name, p.latitude, p.longitude, 
           u.name as reporter_name, v.name as vendor_name, m.company_name
    FROM complaints c
    JOIN poles p ON c.pole_id = p.pole_id
    LEFT JOIN users u ON c.reported_by = u.id
    LEFT JOIN users v ON c.assigned_vendor_id = v.id
    LEFT JOIN vendors m ON c.assigned_vendor_id = m.user_id
    WHERE 1=1
  `;
  const params = [];

  if (section) {
    sql += ` AND p.section_name = ?`;
    params.push(section);
  }
  if (severity) {
    sql += ` AND c.severity = ?`;
    params.push(severity);
  }
  if (status) {
    sql += ` AND c.status = ?`;
    params.push(status);
  }
  if (is_public !== undefined) {
    sql += ` AND c.is_public = ?`;
    params.push(parseInt(is_public));
  }
  if (is_moderated !== undefined) {
    sql += ` AND c.is_moderated = ?`;
    params.push(parseInt(is_moderated));
  }

  sql += ` ORDER BY c.created_at DESC`;

  try {
    const complaints = await allQuery(sql, params);
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Complaints: Create
app.post('/api/complaints', async (req, res) => {
  const { poleId, reportedBy, severity, category, mediaUrl, description, isPublic } = req.body;

  if (!poleId || !severity || !category || !description) {
    return res.status(400).json({ error: 'Pole ID, severity, category, and description are required' });
  }

  // File upload is required for Critical complaints
  if (severity === 'Critical' && !mediaUrl) {
    return res.status(400).json({ error: 'A photo or video upload is required for Critical severity complaints.' });
  }

  const id = generateComplaintId();
  const is_public_val = isPublic ? 1 : 0;
  const is_moderated_val = isPublic ? 0 : 1; // Internal staff reports do not need moderation

  try {
    // Validate pole exists
    const pole = await getQuery('SELECT pole_id FROM poles WHERE pole_id = ?', [poleId]);
    if (!pole) {
      return res.status(404).json({ error: 'Pole ID does not exist in the database' });
    }

    await runQuery(
      `INSERT INTO complaints (id, pole_id, reported_by, severity, category, media_url, description, status, is_public, is_moderated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Raised', ?, ?)`,
      [id, poleId, reportedBy || null, severity, category, mediaUrl || null, description, is_public_val, is_moderated_val]
    );

    // Add status history entry
    await runQuery(
      `INSERT INTO complaint_status_log (complaint_id, changed_by, from_status, to_status, notes)
       VALUES (?, ?, 'None', 'Raised', 'Complaint registered')`,
      [id, reportedBy || null]
    );

    // Critical trigger alert response stub
    let isCriticalAlertSent = false;
    if (severity === 'Critical') {
      isCriticalAlertSent = true;
      console.log(`[SMS/EMAIL STUB]: CRITICAL COMPLAINT ALERT! ID: ${id} at ${poleId}. Category: ${category}. Assigned section supervisors notified.`);
    }

    res.status(201).json({
      message: 'Complaint filed successfully',
      complaintId: id,
      criticalAlertSent: isCriticalAlertSent
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Complaints: Immediate / Shortcut
app.post('/api/complaints/immediate', async (req, res) => {
  const { poleId, reportedBy, category, mediaUrl, description } = req.body;

  if (!poleId || !category || !description) {
    return res.status(400).json({ error: 'Pole ID, category, and description are required' });
  }

  if (!mediaUrl) {
    return res.status(400).json({ error: 'Photo upload is required for critical issues.' });
  }

  const id = generateComplaintId();

  try {
    const pole = await getQuery('SELECT pole_id FROM poles WHERE pole_id = ?', [poleId]);
    if (!pole) {
      return res.status(404).json({ error: 'Pole ID does not exist' });
    }

    await runQuery(
      `INSERT INTO complaints (id, pole_id, reported_by, severity, category, media_url, description, status, is_public, is_moderated)
       VALUES (?, ?, ?, 'Critical', ?, ?, ?, 'Raised', 0, 1)`,
      [id, poleId, reportedBy || null, category, mediaUrl, description]
    );

    await runQuery(
      `INSERT INTO complaint_status_log (complaint_id, changed_by, from_status, to_status, notes)
       VALUES (?, ?, 'None', 'Raised', 'Immediate Critical complaint filed')`,
      [id, reportedBy || null]
    );

    console.log(`[SMS/EMAIL STUB]: CRITICAL IMMEDIATE COMPLAINT ALERT! ID: ${id} at ${poleId}.`);

    res.status(201).json({
      message: 'Immediate Critical Complaint filed successfully',
      complaintId: id,
      criticalAlertSent: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Complaints: Update Status & Lifecycle
app.patch('/api/complaints/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, notes, assignedVendorId } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const complaint = await getQuery('SELECT * FROM complaints WHERE id = ?', [id]);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const prevStatus = complaint.status;
    let vendorUpdateVal = complaint.assigned_vendor_id;

    if (assignedVendorId !== undefined) {
      vendorUpdateVal = assignedVendorId;
    }

    await runQuery(
      `UPDATE complaints 
       SET status = ?, assigned_vendor_id = ?, updated_at = datetime('now', 'localtime') 
       WHERE id = ?`,
      [status, vendorUpdateVal, id]
    );

    // Insert change log
    await runQuery(
      `INSERT INTO complaint_status_log (complaint_id, changed_by, from_status, to_status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.user.id, prevStatus, status, notes || 'Status updated']
    );

    res.json({ message: 'Complaint status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Complaints: Moderate Public Report
app.patch('/api/complaints/:id/moderate', authenticateToken, requireRoles(['supervisor', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  try {
    const complaint = await getQuery('SELECT * FROM complaints WHERE id = ?', [id]);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (action === 'approve') {
      await runQuery('UPDATE complaints SET is_moderated = 1 WHERE id = ?', [id]);
      res.json({ message: 'Complaint approved and added to official queue' });
    } else if (action === 'reject') {
      await runQuery("UPDATE complaints SET status = 'Closed', is_moderated = 1 WHERE id = ?", [id]);
      await runQuery(
        `INSERT INTO complaint_status_log (complaint_id, changed_by, from_status, to_status, notes)
         VALUES (?, ?, ?, 'Closed', 'Report rejected during moderation')`,
        [id, req.user.id, complaint.status]
      );
      res.json({ message: 'Complaint rejected and closed' });
    } else {
      res.status(400).json({ error: "Invalid action. Must be 'approve' or 'reject'" });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Complaints: Logs / History
app.get('/api/complaints/:id/history', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const logs = await allQuery(
      `SELECT l.*, u.name as user_name, u.role as user_role 
       FROM complaint_status_log l
       LEFT JOIN users u ON l.changed_by = u.id
       WHERE l.complaint_id = ?
       ORDER BY l.timestamp ASC`,
      [id]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 5. Maintenance: Get All
app.get('/api/maintenance', authenticateToken, async (req, res) => {
  try {
    const schedule = await allQuery(
      `SELECT m.*, u.name as staff_name, p.section_name, p.latitude, p.longitude 
       FROM maintenance_schedule m
       JOIN poles p ON m.pole_id = p.pole_id
       LEFT JOIN users u ON m.assigned_staff_id = u.id
       ORDER BY m.due_date ASC`
    );
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Maintenance: Create (Schedule Inspection)
app.post('/api/maintenance', authenticateToken, requireRoles(['supervisor', 'admin']), async (req, res) => {
  const { sectionName, poleId, assignedStaffId, dueDate, notes } = req.body;

  if (!sectionName || !poleId || !dueDate) {
    return res.status(400).json({ error: 'Section, Pole ID, and Due Date are required' });
  }

  try {
    const result = await runQuery(
      `INSERT INTO maintenance_schedule (section_name, pole_id, assigned_staff_id, due_date, status, notes)
       VALUES (?, ?, ?, ?, 'Pending', ?)`,
      [sectionName, poleId, assignedStaffId || null, dueDate, notes || '']
    );
    res.status(201).json({ message: 'Inspection scheduled successfully', scheduleId: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Maintenance: Complete Inspection
app.patch('/api/maintenance/:id/complete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { notes, status = 'Completed' } = req.body;

  try {
    const task = await getQuery('SELECT * FROM maintenance_schedule WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Maintenance task not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    await runQuery(
      `UPDATE maintenance_schedule 
       SET status = ?, completed_date = ?, notes = ? 
       WHERE id = ?`,
      [status, todayStr, notes || 'Inspected and logged', id]
    );

    // Update pole's last inspection date
    await runQuery(
      `UPDATE poles SET last_inspection_date = ? WHERE pole_id = ?`,
      [todayStr, task.pole_id]
    );

    res.json({ message: 'Maintenance task marked as completed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 6. Vendor Module: List Vendors
app.get('/api/vendors', authenticateToken, async (req, res) => {
  try {
    const list = await allQuery(
      `SELECT u.id as user_id, u.name, u.phone, u.username as employee_id,
              v.company_name, v.assigned_sections, v.specialization
       FROM users u
       JOIN vendors v ON u.id = v.user_id`
    );
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Vendor: Suggest vendor based on section mapping and category
app.get('/api/vendors/suggest', authenticateToken, async (req, res) => {
  const { sectionName } = req.query;

  if (!sectionName) {
    return res.status(400).json({ error: 'sectionName is required' });
  }

  try {
    const list = await allQuery(
      `SELECT u.id as user_id, u.name, v.company_name, v.assigned_sections, v.specialization
       FROM users u
       JOIN vendors v ON u.id = v.user_id`
    );

    // Filter vendors whose assigned_sections (comma separated) include the query sectionName
    const suggestions = list.filter(vendor => {
      const sections = vendor.assigned_sections.split(',').map(s => s.trim().toLowerCase());
      return sections.includes(sectionName.toLowerCase());
    });

    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Vendor Performance Metrics
app.get('/api/vendors/performance', authenticateToken, requireRoles(['supervisor', 'admin']), async (req, res) => {
  try {
    // Return performance counts
    const complaints = await allQuery(`
      SELECT c.id, c.status, c.assigned_vendor_id, c.created_at, c.updated_at,
             l.timestamp as resolved_timestamp
      FROM complaints c
      LEFT JOIN complaint_status_log l ON c.id = l.complaint_id AND l.to_status = 'Resolved'
      WHERE c.assigned_vendor_id IS NOT NULL
    `);

    const vendors = await allQuery(
      `SELECT u.id as user_id, u.name, v.company_name, v.specialization
       FROM users u
       JOIN vendors v ON u.id = v.user_id`
    );

    const perfData = vendors.map(vendor => {
      const vendorJobs = complaints.filter(c => c.assigned_vendor_id === vendor.user_id);
      const totalJobs = vendorJobs.length;
      const resolvedJobs = vendorJobs.filter(c => c.status === 'Resolved' || c.status === 'Closed');

      // Calculate average resolution time in hours
      let totalResolutionTimeMs = 0;
      let resolvedWithTimeCount = 0;

      resolvedJobs.forEach(job => {
        const created = new Date(job.created_at);
        const resolved = job.resolved_timestamp ? new Date(job.resolved_timestamp) : new Date(job.updated_at);
        const diffMs = resolved - created;
        if (diffMs > 0) {
          totalResolutionTimeMs += diffMs;
          resolvedWithTimeCount++;
        }
      });

      const avgResolutionHours = resolvedWithTimeCount > 0 
        ? Math.round((totalResolutionTimeMs / (1000 * 60 * 60)) * 10) / 10 
        : 0;

      return {
        vendorId: vendor.user_id,
        name: vendor.name,
        companyName: vendor.company_name,
        specialization: vendor.specialization,
        totalJobs,
        resolvedJobsCount: resolvedJobs.length,
        pendingJobsCount: totalJobs - resolvedJobs.length,
        avgResolutionHours
      };
    });

    res.json(perfData);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`RailTrack Monitor Server is running on port ${PORT}`);
});
