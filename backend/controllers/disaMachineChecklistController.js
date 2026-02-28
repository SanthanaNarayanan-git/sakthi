const sql = require('../db');

// --- 1. Get Details (DYNAMIC JOIN) ---
exports.getChecklistDetails = async (req, res) => {
  try {
    const { date, disaMachine } = req.query;
    
    const checklistResult = await sql.query`
      SELECT 
          M.MasterId, M.SlNo, M.CheckPointDesc, M.CheckMethod, 
          ISNULL(T.IsDone, 0) as IsDone, 
          ISNULL(T.IsHoliday, 0) as IsHoliday,
          ISNULL(T.IsVatCleaning, 0) as IsVatCleaning,
          ISNULL(T.ReadingValue, '') as ReadingValue,
          T.AssignedHOD, T.OperatorSignature
      FROM MachineChecklist_Master M
      LEFT JOIN MachineChecklist_Trans T 
          ON M.MasterId = T.MasterId 
          AND T.LogDate = ${date}
          AND T.DisaMachine = ${disaMachine}
      WHERE M.IsDeleted = 0
      ORDER BY M.SlNo ASC
    `;
    
    const hodsResult = await sql.query`SELECT username as OperatorName FROM dbo.Users WHERE role = 'hod' ORDER BY username`;
    const reportsResult = await sql.query`SELECT * FROM dbo.DisaNonConformanceReport WHERE ReportDate = ${date} AND DisaMachine = ${disaMachine}`;

    res.json({
      checklist: checklistResult.recordset,
      operators: hodsResult.recordset, 
      reports: reportsResult.recordset 
    });
  } catch (err) { res.status(500).send(err.message); }
};

// --- 2. Batch Submit ---
exports.saveBatchChecklist = async (req, res) => {
  try {
    const { items, sign, date, disaMachine, operatorSignature } = req.body; 
    const transaction = new sql.Transaction();
    await transaction.begin();
    try {
      for (const item of items) {
        const request = new sql.Request(transaction); 
        const checkRes = await request.query`SELECT COUNT(*) as count FROM MachineChecklist_Trans WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}`;
        
        const q = checkRes.recordset[0].count > 0 
          ? `UPDATE MachineChecklist_Trans SET IsDone=@idne, IsHoliday=@ihol, IsVatCleaning=@ivat, ReadingValue=@rval, AssignedHOD=@hod, OperatorSignature=@osig, LastUpdated=GETDATE() WHERE MasterId=@mid AND LogDate=@date AND DisaMachine=@dm`
          : `INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, IsHoliday, IsVatCleaning, ReadingValue, AssignedHOD, OperatorSignature, DisaMachine) VALUES (@mid, @date, @idne, @ihol, @ivat, @rval, @hod, @osig, @dm)`;

        const req2 = new sql.Request(transaction);
        req2.input('mid', item.MasterId).input('date', date).input('dm', disaMachine)
            .input('idne', item.IsDone ? 1 : 0).input('ihol', item.IsHoliday ? 1 : 0)
            .input('ivat', item.IsVatCleaning ? 1 : 0).input('rval', item.ReadingValue || '')
            .input('hod', sign).input('osig', operatorSignature);
        await req2.query(q);
      }
      await transaction.commit();
      res.json({ success: true });
    } catch (err) { await transaction.rollback(); throw err; }
  } catch (err) { res.status(500).send(err.message); }
};

// --- 3. Bulk Data for Admin Export ---
exports.getBulkData = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const request = new sql.Request();
        
        const masterRes = await sql.query`SELECT * FROM MachineChecklist_Master WHERE IsDeleted = 0 ORDER BY SlNo ASC`;
        const transRes = await sql.query(`
            SELECT T.*, M.CheckPointDesc, M.CheckMethod, M.SlNo 
            FROM MachineChecklist_Trans T
            INNER JOIN MachineChecklist_Master M ON T.MasterId = M.MasterId
            WHERE T.LogDate BETWEEN '${fromDate}' AND '${toDate}'
        `);
        const ncrRes = await sql.query(`SELECT * FROM DisaNonConformanceReport WHERE ReportDate BETWEEN '${fromDate}' AND '${toDate}'`);

        res.json({ master: masterRes.recordset, trans: transRes.recordset, ncr: ncrRes.recordset });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// ... existing Monthly Report and HOD Sign methods ...

// --- 1. Get Details ---
exports.getChecklistDetails = async (req, res) => {
  try {
    const { date, disaMachine } = req.query;
    
    const checklistResult = await sql.query`
      SELECT 
          M.MasterId, 
          M.SlNo, 
          M.CheckPointDesc, 
          M.CheckMethod, 
          ISNULL(T.IsDone, 0) as IsDone, 
          ISNULL(T.IsHoliday, 0) as IsHoliday,
          ISNULL(T.IsVatCleaning, 0) as IsVatCleaning,
          ISNULL(T.ReadingValue, '') as ReadingValue,
          T.Sign,
          T.OperatorSignature -- Send signature to frontend to pre-fill pad
      FROM MachineChecklist_Master M
      LEFT JOIN MachineChecklist_Trans T 
          ON M.MasterId = T.MasterId 
          AND T.LogDate = ${date}
          AND T.DisaMachine = ${disaMachine}
      ORDER BY M.SlNo ASC
    `;
    
    // 🔥 Changed: Fetch users with role 'hod' instead of operators
    const hodsResult = await sql.query`SELECT username as OperatorName FROM dbo.Users WHERE role = 'hod' ORDER BY username`;
    
    const reportsResult = await sql.query`
      SELECT * FROM dbo.DisaNonConformanceReport 
      WHERE ReportDate = ${date} AND DisaMachine = ${disaMachine}
    `;

    res.json({
      checklist: checklistResult.recordset,
      operators: hodsResult.recordset, // Sent as "operators" to not break frontend var names
      reports: reportsResult.recordset 
    });

  } catch (err) {
    console.error('Error fetching details:', err);
    res.status(500).send(err.message);
  }
};

// --- 2. Batch Submit ---
exports.saveBatchChecklist = async (req, res) => {
  try {
    // 'sign' is now the assigned HOD name
    const { items, sign, date, disaMachine, operatorSignature } = req.body; 
    if (!items || !date || !disaMachine) return res.status(400).send("Data missing");

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      for (const item of items) {
        const request = new sql.Request(transaction); 

        const checkRes = await request.query`
            SELECT COUNT(*) as count FROM MachineChecklist_Trans 
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
        `;
        
        const isDoneVal = item.IsDone ? 1 : 0;
        const isHolidayVal = item.IsHoliday ? 1 : 0;
        const isVatVal = item.IsVatCleaning ? 1 : 0; 
        const readingVal = item.ReadingValue || ''; 

        const writeRequest = new sql.Request(transaction);

        if (checkRes.recordset[0].count > 0) {
          await writeRequest.query`
            UPDATE MachineChecklist_Trans 
            SET IsDone = ${isDoneVal}, IsHoliday = ${isHolidayVal}, IsVatCleaning = ${isVatVal}, 
                ReadingValue = ${readingVal}, AssignedHOD = ${sign}, OperatorSignature = ${operatorSignature}, LastUpdated = GETDATE()
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
          `;
        } else {
          await writeRequest.query`
            INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, IsHoliday, IsVatCleaning, ReadingValue, AssignedHOD, OperatorSignature, DisaMachine)
            VALUES (${item.MasterId}, ${date}, ${isDoneVal}, ${isHolidayVal}, ${isVatVal}, ${readingVal}, ${sign}, ${operatorSignature}, ${disaMachine})
          `;
        }
      }
      
      await transaction.commit();
      res.json({ success: true });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error saving batch:', err);
    res.status(500).send(err.message);
  }
};

// --- 3. Save NC Report ---
exports.saveNCReport = async (req, res) => {
  // (Unchanged from original)
  try {
    const { 
        checklistId, slNo, reportDate, ncDetails, correction, 
        rootCause, correctiveAction, targetDate, responsibility, sign, disaMachine 
    } = req.body;

    await sql.query`
      INSERT INTO DisaNonConformanceReport (
        MasterId, ReportDate, NonConformityDetails, Correction, 
        RootCause, CorrectiveAction, TargetDate, Responsibility, 
        Sign, Status, DisaMachine
      )
      VALUES (
        ${checklistId}, ${reportDate}, ${ncDetails}, ${correction}, 
        ${rootCause}, ${correctiveAction}, ${targetDate}, ${responsibility}, 
        ${sign}, 'Pending', ${disaMachine}
      )
    `;

    const checkRow = await sql.query`
        SELECT COUNT(*) as count FROM MachineChecklist_Trans 
        WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}
    `;
    
    if (checkRow.recordset[0].count > 0) {
       await sql.query`
           UPDATE MachineChecklist_Trans SET IsDone = 0, Sign = ${sign} 
           WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}
       `;
    } else {
       await sql.query`
           INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, Sign, DisaMachine) 
           VALUES (${checklistId}, ${reportDate}, 0, ${sign}, ${disaMachine})
       `;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// --- 4. Monthly Report (Updated for PDF generation) ---
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year, disaMachine } = req.query;
    
    // 🔥 Added OperatorSignature, AssignedHOD, and HODSignature to the fetch
    const checklistResult = await sql.query`
      SELECT MasterId, DAY(LogDate) as DayVal, IsDone, IsHoliday, IsVatCleaning, ReadingValue, OperatorSignature, AssignedHOD, HODSignature
      FROM MachineChecklist_Trans
      WHERE MONTH(LogDate) = ${month} 
        AND YEAR(LogDate) = ${year} 
        AND DisaMachine = ${disaMachine}
    `;

    const ncResult = await sql.query`
      SELECT 
        ReportId, ReportDate, NonConformityDetails, 
        Correction, RootCause, CorrectiveAction, 
        TargetDate, Responsibility, Sign, Status
      FROM DisaNonConformanceReport
      WHERE MONTH(ReportDate) = ${month} 
        AND YEAR(ReportDate) = ${year} 
        AND DisaMachine = ${disaMachine}
      ORDER BY ReportDate ASC
    `;

    res.json({ 
      monthlyLogs: checklistResult.recordset,
      ncReports: ncResult.recordset
    });

  } catch (err) {
    console.error("Monthly Report Error:", err);
    res.status(500).send(err.message);
  }
};

// ==========================================
//        HOD DASHBOARD APIS (NEW)
// ==========================================
exports.getReportsByHOD = async (req, res) => {
  try {
    const { name } = req.params;
    
    // Get unique dates and machines assigned to this HOD that need signing
    const result = await sql.query`
      SELECT DISTINCT LogDate as reportDate, DisaMachine as disa, AssignedHOD as hodName, MAX(HODSignature) as hodSignature
      FROM MachineChecklist_Trans 
      WHERE AssignedHOD = ${name}
      GROUP BY LogDate, DisaMachine, AssignedHOD
      ORDER BY LogDate DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching HOD reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

exports.signReportByHOD = async (req, res) => {
  try {
    const { date, disaMachine, signature } = req.body;
    
    // Apply HOD signature to all records for that day and machine
    await sql.query`
      UPDATE MachineChecklist_Trans 
      SET HODSignature = ${signature} 
      WHERE LogDate = ${date} AND DisaMachine = ${disaMachine}
    `;
    res.json({ message: "Signature saved successfully" });
  } catch (error) {
    console.error("Error saving HOD signature:", error);
    res.status(500).json({ error: "Failed to save signature" });
  }
};

// 🔥 ADD THIS FUNCTION TO THE BOTTOM OF THE FILE
exports.getBulkData = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        // Make sure you have access to your db pool/sql here
        const request = new sql.Request();
        
        // 1. Fetch Dynamic Master Columns
        const masterRes = await request.query(`SELECT * FROM MachineChecklist_Master WHERE IsDeleted = 0 ORDER BY SlNo ASC`);
        
        let transQuery = `
            SELECT T.*, M.CheckPointDesc, M.CheckMethod, M.SlNo 
            FROM MachineChecklist_Trans T
            INNER JOIN MachineChecklist_Master M ON T.MasterId = M.MasterId
        `;
        let ncrQuery = `SELECT * FROM DisaNonConformanceReport`;

        // 2. Filter by Date if provided
        if (fromDate && toDate) {
            transQuery += ` WHERE T.LogDate BETWEEN @fromDate AND @toDate`;
            ncrQuery += ` WHERE ReportDate BETWEEN @fromDate AND @toDate`;
            request.input('fromDate', sql.Date, fromDate);
            request.input('toDate', sql.Date, toDate);
        }

        const transRes = await request.query(transQuery);
        const ncrRes = await request.query(ncrQuery);

        // 3. Send back to Admin Dashboard for PDF Generation
        res.json({ master: masterRes.recordset, trans: transRes.recordset, ncr: ncrRes.recordset });
    } catch (error) { 
        console.error("Error fetching bulk data:", error);
        res.status(500).json({ error: error.message }); 
    }
};