const sql = require('../db');

const mouldController = {
  // --- 1. Get Details for ALL Shifts at once ---
  getMouldDetails: async (req, res) => {
    try {
      const { date, disa } = req.query;

      const result = await sql.query`
        SELECT * FROM UnPouredMouldDetails 
        WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      `;

      const shiftData = { 1: {}, 2: {}, 3: {} };
      result.recordset.forEach(row => {
          shiftData[row.Shift] = row;
          shiftData[row.Shift].customValues = {}; 
      });

      // 🔥 Fetch custom dynamic values
      const customRes = await sql.query`
        SELECT columnId, value, Shift 
        FROM UnPouredCustomValues 
        WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      `;
      
      customRes.recordset.forEach(row => {
          if (!shiftData[row.Shift].customValues) shiftData[row.Shift].customValues = {};
          shiftData[row.Shift].customValues[row.columnId] = row.value;
      });

      res.json(shiftData);
    } catch (err) {
      console.error('Error fetching mould details:', err);
      res.status(500).send('Server Error');
    }
  },

  // --- 2. Save/Update ALL 3 Shifts in one transaction ---
  saveMouldDetails: async (req, res) => {
    try {
      const { date, disa, shiftsData } = req.body;
      const transaction = new sql.Transaction();
      await transaction.begin();

      try {
        for (const shift of [1, 2, 3]) {
          const data = shiftsData[shift];
          const checkReq = new sql.Request(transaction);

          const checkRes = await checkReq.query`
              SELECT COUNT(*) as count FROM UnPouredMouldDetails 
              WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift}
          `;

          const getVal = (val) => parseInt(val) || 0;
          const writeRequest = new sql.Request(transaction);

          // Save main table
          if (checkRes.recordset[0].count > 0) {
            await writeRequest.query`
              UPDATE UnPouredMouldDetails SET 
                PatternChange = ${getVal(data.patternChange)}, HeatCodeChange = ${getVal(data.heatCodeChange)}, 
                MouldBroken = ${getVal(data.mouldBroken)}, AmcCleaning = ${getVal(data.amcCleaning)}, 
                MouldCrush = ${getVal(data.mouldCrush)}, CoreFalling = ${getVal(data.coreFalling)},
                SandDelay = ${getVal(data.sandDelay)}, DrySand = ${getVal(data.drySand)},
                NozzleChange = ${getVal(data.nozzleChange)}, NozzleLeakage = ${getVal(data.nozzleLeakage)}, 
                SpoutPocking = ${getVal(data.spoutPocking)}, StRod = ${getVal(data.stRod)},
                QcVent = ${getVal(data.qcVent)}, OutMould = ${getVal(data.outMould)}, 
                LowMg = ${getVal(data.lowMg)}, GradeChange = ${getVal(data.gradeChange)}, MsiProblem = ${getVal(data.msiProblem)},
                BrakeDown = ${getVal(data.brakeDown)}, Wom = ${getVal(data.wom)}, DevTrail = ${getVal(data.devTrail)},
                PowerCut = ${getVal(data.powerCut)}, PlannedOff = ${getVal(data.plannedOff)}, 
                VatCleaning = ${getVal(data.vatCleaning)}, Others = ${getVal(data.others)},
                RowTotal = ${getVal(data.rowTotal)}, OperatorSignature = ${data.operatorSignature || null},
                LastUpdated = GETDATE()
              WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift}
            `;
          } else {
            await writeRequest.query`
              INSERT INTO UnPouredMouldDetails (
                RecordDate, DisaMachine, Shift, 
                PatternChange, HeatCodeChange, MouldBroken, AmcCleaning, MouldCrush, CoreFalling,
                SandDelay, DrySand, NozzleChange, NozzleLeakage, SpoutPocking, StRod,
                QcVent, OutMould, LowMg, GradeChange, MsiProblem, BrakeDown, Wom, DevTrail,
                PowerCut, PlannedOff, VatCleaning, Others, RowTotal, OperatorSignature
              ) VALUES (
                ${date}, ${disa}, ${shift}, 
                ${getVal(data.patternChange)}, ${getVal(data.heatCodeChange)}, ${getVal(data.mouldBroken)}, ${getVal(data.amcCleaning)}, ${getVal(data.mouldCrush)}, ${getVal(data.coreFalling)},
                ${getVal(data.sandDelay)}, ${getVal(data.drySand)}, ${getVal(data.nozzleChange)}, ${getVal(data.nozzleLeakage)}, ${getVal(data.spoutPocking)}, ${getVal(data.stRod)},
                ${getVal(data.qcVent)}, ${getVal(data.outMould)}, ${getVal(data.lowMg)}, ${getVal(data.gradeChange)}, ${getVal(data.msiProblem)},
                ${getVal(data.brakeDown)}, ${getVal(data.wom)}, ${getVal(data.devTrail)},
                ${getVal(data.powerCut)}, ${getVal(data.plannedOff)}, ${getVal(data.vatCleaning)}, ${getVal(data.others)}, ${getVal(data.rowTotal)},
                ${data.operatorSignature || null}
              )
            `;
          }

          // 🔥 Save dynamic Custom Values
          if (data.customValues) {
            for (const [colId, val] of Object.entries(data.customValues)) {
                const numVal = parseInt(val) || 0;
                const vReq = new sql.Request(transaction);
                const existing = await vReq.query`SELECT id FROM UnPouredCustomValues WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift} AND columnId = ${colId}`;
                
                if (existing.recordset.length > 0) {
                    await new sql.Request(transaction).query`UPDATE UnPouredCustomValues SET value = ${numVal} WHERE id = ${existing.recordset[0].id}`;
                } else {
                    await new sql.Request(transaction).query`INSERT INTO UnPouredCustomValues (RecordDate, DisaMachine, Shift, columnId, value) VALUES (${date}, ${disa}, ${shift}, ${colId}, ${numVal})`;
                }
            }
          }
        }
        await transaction.commit();
        res.json({ success: true, message: 'All shifts saved successfully' });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      console.error('Error saving details:', err);
      res.status(500).send('Server Error');
    }
  },

  // --- 3. Fetch Bulk Data for Admin PDF Export ---
  getBulkData: async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const request = new sql.Request();
        
        let query = `SELECT * FROM UnPouredMouldDetails`;
        if (fromDate && toDate) {
            query += ` WHERE RecordDate BETWEEN @fromDate AND @toDate`;
            request.input('fromDate', sql.Date, fromDate);
            request.input('toDate', sql.Date, toDate);
        }
        
        const result = await request.query(query);
        const records = result.recordset;

        if (records.length === 0) return res.json({ records: [] });

        const customReq = new sql.Request();
        if (fromDate && toDate) {
            customReq.input('fromDate', sql.Date, fromDate);
            customReq.input('toDate', sql.Date, toDate);
        }
        const customRes = await customReq.query(`SELECT * FROM UnPouredCustomValues ${fromDate ? 'WHERE RecordDate BETWEEN @fromDate AND @toDate' : ''}`);

        // Merge custom values back into records
        const mergedRecords = records.map(r => {
            const cVals = {};
            customRes.recordset
                .filter(cv => String(cv.RecordDate) === String(r.RecordDate) && cv.DisaMachine === r.DisaMachine && cv.Shift === r.Shift)
                .forEach(cv => { cVals[cv.columnId] = cv.value; });
            return { ...r, customValues: cVals };
        });

        res.json({ records: mergedRecords });
    } catch (error) {
        console.error("Error fetching bulk data:", error);
        res.status(500).json({ error: "Failed to fetch bulk data" });
    }
  }
};

module.exports = mouldController;