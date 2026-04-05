import { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
  ThemeProvider,
  createTheme,
  Chip,
  Snackbar,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";

import { API_BASE } from "./apiConfig";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#5B5BD6" },
    secondary: { main: "#0EA5A6" },
    background: {
      default: "#F4F7FF",
      paper: "#FFFFFF"
    }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          textTransform: "none",
          fontWeight: 700
        }
      }
    }
  }
});

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [sessionsByRoom, setSessionsByRoom] = useState({});
  const [reports, setReports] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [editingSession, setEditingSession] = useState(null);
  const [editingCapacity, setEditingCapacity] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [peopleBySession, setPeopleBySession] = useState([]);
  const [roomSessionForms, setRoomSessionForms] = useState([]);
  const [csvPayload, setCsvPayload] = useState({
    peopleBySession: "",
    roomSessionForms: {},
    roomSessionFormsAll: ""
  });
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState("");
  const [clearingDatabase, setClearingDatabase] = useState(false);

  // Load rooms and sessions on mount
  useEffect(() => {
    if (isLoggedIn) {
      loadReportsAndSessions();
    }
  }, [isLoggedIn]);

  // Refresh reports when tab changes to Reports (index 1)
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    if (newValue === 1) {
      // Reports tab
      loadReportsAndSessions();
      loadDetailedReports();
    }
  };

  const loginAndLoadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const encodedCreds = btoa(`${username}:${password}`);
      const response = await fetch(`${API_BASE}/admin/sessions-by-room`, {
        headers: { Authorization: `Basic ${encodedCreds}` }
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      // Store credentials for future requests
      sessionStorage.setItem("adminAuth", encodedCreds);
      setIsLoggedIn(true);
      await loadReportsAndSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadReportsAndSessions = async () => {
    try {
      const encodedCreds = sessionStorage.getItem("adminAuth");
      if (!encodedCreds) return;

      // Fetch sessions by room
      const response = await fetch(`${API_BASE}/admin/sessions-by-room`, {
        headers: { Authorization: `Basic ${encodedCreds}` }
      });

      if (!response.ok) throw new Error("Failed to load data");

      const groupedByRoomName = await response.json();
      
      // Process the grouped data structure from backend
      const roomsMap = new Map();
      const sessionsByRoomId = {};
      const allReports = [];

      // Iterate through grouped by room name
      Object.entries(groupedByRoomName).forEach(([roomName, sessions]) => {
        if (sessions.length > 0) {
          const firstSession = sessions[0];
          const roomId = firstSession.roomId;
          
          // Track unique rooms
          if (!roomsMap.has(roomId)) {
            roomsMap.set(roomId, {
              id: roomId,
              name: roomName,
              capacity: firstSession.capacity
            });
          }

          // Group sessions by room ID
          if (!sessionsByRoomId[roomId]) {
            sessionsByRoomId[roomId] = [];
          }
          
          sessions.forEach((session) => {
            sessionsByRoomId[roomId].push({
              id: session.id,
              timeSlot: `${session.startTime} - ${session.endTime}`,
              capacity: session.capacity,
              reservedCount: session.reservedCount,
              isFull: session.reservedCount >= session.capacity
            });

            // Add to reports
            allReports.push({
              timeSlot: `${session.startTime} - ${session.endTime}`,
              roomName: roomName,
              capacity: session.capacity,
              reservedCount: session.reservedCount,
              isFull: session.reservedCount >= session.capacity
            });
          });
        }
      });

      setRooms(Array.from(roomsMap.values()));
      setSessionsByRoom(sessionsByRoomId);
      setReports(allReports);

      // Also fetch detailed reports
      await loadDetailedReports();
    } catch (err) {
      setError(err.message);
    }
  };

  const loadDetailedReports = async () => {
    try {
      const encodedCreds = sessionStorage.getItem("adminAuth");
      if (!encodedCreds) return;

      const response = await fetch(`${API_BASE}/admin/reports`, {
        headers: { Authorization: `Basic ${encodedCreds}` }
      });

      if (!response.ok) throw new Error("Failed to load detailed reports");

      const data = await response.json();
      setPeopleBySession(data.peopleBySession);
      setRoomSessionForms(data.roomSessionForms);
      setCsvPayload(data.csv);
    } catch (err) {
      setError("Failed to load detailed reports: " + err.message);
    }
  };

  const handleSaveCapacity = async (sessionId) => {
    try {
      const encodedCreds = sessionStorage.getItem("adminAuth");
      const newCapacity = editingCapacity[sessionId] ?? 0;

      const response = await fetch(`${API_BASE}/admin/sessions/${sessionId}/capacity`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedCreds}`
        },
        body: JSON.stringify({ newCapacity })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update capacity");
      }

      setSuccessMessage("Capacity updated successfully!");
      setEditingSession(null);
      setEditingCapacity({});
      await loadReportsAndSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportReports = () => {
    if (!reports.length) return;

    const headers = ["Date/Time", "Room", "Capacity", "Reserved", "Status"];
    const rows = reports.map((r) => [
      r.timeSlot,
      r.roomName,
      r.capacity,
      r.reservedCount,
      r.isFull ? "Full" : "Available"
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    downloadCsv("appointment-reports.csv", csv);
  };

  const handleClearDatabase = async () => {
    if (clearConfirmation !== "I UNDERSTAND") {
      setError("Please type 'I UNDERSTAND' to confirm.");
      return;
    }

    setClearingDatabase(true);
    setError("");

    try {
      await loadDetailedReports();

      // ensure we use latest payload values
      const backupCsv1 = csvPayload.peopleBySession;
      const backupCsv2 = csvPayload.roomSessionFormsAll;

      if (!backupCsv1 || !backupCsv2) {
        throw new Error("Backup report data unavailable.");
      }

      // Download both reports
      downloadCsv("participants-and-sessions-backup.csv", backupCsv1);
      downloadCsv("all-workshops-backup.csv", backupCsv2);

      const encodedCreds = sessionStorage.getItem("adminAuth");
      if (!encodedCreds) {
        throw new Error("Admin credentials missing. Please re-login.");
      }

      const response = await fetch(`${API_BASE}/admin/clear-database`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedCreds}`
        }
      });

      let result;
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch (_e) {
        result = null;
      }

      if (!response.ok) {
        const message = result?.error || text || `HTTP ${response.status}`;
        throw new Error(`Failed to clear database: ${message}`);
      }

      // Refresh data after successful clear
      await loadReportsAndSessions();
      await loadDetailedReports();

      setSuccessMessage("Database cleared successfully! Backup reports downloaded.");
      setClearDialogOpen(false);
      setClearConfirmation("");
    } catch (err) {
      setError("Failed to clear database: " + err.message);
    } finally {
      setClearingDatabase(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <Box sx={{ minHeight: "100dvh", backgroundColor: "#f6f8ff", py: 4 }}>
        <Container maxWidth="sm">
          <Card sx={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h4" fontWeight={700} textAlign="center">
                  Admin Panel
                </Typography>
                <Typography color="text.secondary" textAlign="center">
                  Sign in to manage capacity and view reports
                </Typography>
                {error && <Alert severity="error">{error}</Alert>}
                <Stack spacing={2}>
                  <TextField
                    label="Username"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    size="large"
                    onClick={loginAndLoadReports}
                    disabled={!username || !password || loading}
                    fullWidth
                  >
                    {loading ? "Loading..." : "Sign In"}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100dvh", bgcolor: "#F4F7FF", p: 3 }}>
        <Container maxWidth="lg" sx={{ pt: 2 }}>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: "#333", mb: 1 }}>
              Admin Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: "#666" }}>
              Manage room capacity and view session reports
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setClearDialogOpen(true)}
                sx={{ borderColor: "#d32f2f", color: "#d32f2f", "&:hover": { borderColor: "#b71c1c", bgcolor: "#ffebee" } }}
              >
                ⚠️ Clear Database
              </Button>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Tabs */}
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label="Capacity Management" />
            <Tab label="Reports" />
          </Tabs>

          {/* Content */}
          {tabValue === 0 ? (
            <>
              {/* Room Selector */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: "#333" }}>
                  Select Room
                </Typography>
                <Grid container spacing={2}>
                  {rooms.map((room) => (
                    <Grid item xs={12} sm={6} md={4} key={room.id}>
                      <Paper
                        onClick={() => setSelectedRoom(room)}
                        sx={{
                          p: 2,
                          cursor: "pointer",
                          border: selectedRoom?.id === room.id ? "3px solid #5B5BD6" : "2px solid #E0E0E0",
                          borderRadius: 2,
                          bgcolor: selectedRoom?.id === room.id ? "#F4F7FF" : "#FFFFFF",
                          transition: "all 0.2s",
                          "&:hover": {
                            borderColor: "#5B5BD6",
                            boxShadow: "0 4px 12px rgba(91, 91, 214, 0.1)"
                          }
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#333", mb: 1 }}>
                          {room.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#666" }}>
                          Capacity: {room.capacity}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {selectedRoom && (
                <>
                  {/* Sessions for selected room */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: "#333" }}>
                      Sessions - {selectedRoom.name}
                    </Typography>
                    <Grid container spacing={2}>
                      {sessionsByRoom[selectedRoom.id]?.map((session) => (
                        <Grid item xs={12} md={6} key={session.id}>
                          <Paper sx={{ p: 2, border: "1px solid #E0E0E0", borderRadius: 2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                              <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: "#333", mb: 0.5 }}>
                                  {session.timeSlot}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "#0EA5A6", fontWeight: 600 }}>
                                  {session.reservedCount}/{session.capacity} reserved
                                </Typography>
                              </Box>
                              <Box>
                                {session.isFull ? (
                                  <Chip label="Full" color="error" variant="filled" size="small" />
                                ) : (
                                  <Chip label="Available" color="success" variant="filled" size="small" />
                                )}
                              </Box>
                            </Box>

                            {/* Capacity adjustment */}
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, mt: 1, minHeight: "80px" }}>
                              <Typography
                                variant="h6"
                                sx={{
                                  fontWeight: 900,
                                  color: "#333",
                                  minWidth: "80px",
                                  textAlign: "center",
                                  fontSize: "1.5rem"
                                }}
                              >
                                {editingCapacity[session.id] ?? session.capacity}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    const currentCapacity = editingCapacity[session.id] ?? session.capacity;
                                    const newCapacity = Math.max((session.reservedCount || 0), currentCapacity - 1);
                                    setEditingCapacity({ ...editingCapacity, [session.id]: newCapacity });
                                    setEditingSession(session.id);
                                  }}
                                  disabled={(editingCapacity[session.id] ?? session.capacity) <= (session.reservedCount || 0)}
                                >
                                  -
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    const currentCapacity = editingCapacity[session.id] ?? session.capacity;
                                    setEditingCapacity({ ...editingCapacity, [session.id]: currentCapacity + 1 });
                                    setEditingSession(session.id);
                                  }}
                                >
                                  +
                                </Button>
                              </Box>
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5, visibility: editingSession === session.id ? "visible" : "hidden" }}>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={() => handleSaveCapacity(session.id)}
                                  disabled={editingSession !== session.id}
                                  sx={{ bgcolor: "#0EA5A6" }}
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    setEditingSession(null);
                                    setEditingCapacity({});
                                  }}
                                  disabled={editingSession !== session.id}
                                >
                                  Cancel
                                </Button>
                              </Box>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </>
              )}
            </>
          ) : (
            <>
              {/* Reports Tab */}
              <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    loadReportsAndSessions();
                    loadDetailedReports();
                  }}
                  sx={{ bgcolor: "#5B5BD6", "&:hover": { bgcolor: "#4A4AC0" } }}
                >
                  Refresh Reports
                </Button>
              </Box>

              {/* Capacity Report */}
              <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #E0E0E0", mb: 4 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#333" }}>
                    Session Capacity Report
                  </Typography>
                  <Button onClick={handleExportReports} variant="outlined" size="small">
                    Download CSV
                  </Button>
                </Box>
                <Box sx={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #E0E0E0", backgroundColor: "#F4F7FF" }}>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>Date/Time</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>Room</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>Capacity</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>Reserved</th>
                        <th style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #E0E0E0" }}>
                          <td style={{ padding: "12px", color: "#333" }}>{report.timeSlot}</td>
                          <td style={{ padding: "12px", color: "#333" }}>{report.roomName}</td>
                          <td style={{ padding: "12px", color: "#333" }}>{report.capacity}</td>
                          <td style={{ padding: "12px", color: "#333" }}>{report.reservedCount}</td>
                          <td style={{ padding: "12px" }}>
                            <Chip
                              label={report.isFull ? "Full" : "Available"}
                              color={report.isFull ? "error" : "success"}
                              variant="filled"
                              size="small"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Paper>

              {/* People by Session Report */}
              <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #E0E0E0", mb: 4 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#333" }}>
                    Participants and Their Session Selections
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => downloadCsv("participants-and-sessions.csv", csvPayload.peopleBySession)}
                  >
                    Download CSV
                  </Button>
                </Box>
                <Box sx={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #E0E0E0", backgroundColor: "#F4F7FF" }}>
                        {peopleBySession.length > 0 && Object.keys(peopleBySession[0]).map((header) => (
                          <th key={header} style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {peopleBySession.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #E0E0E0" }}>
                          {Object.values(row).map((value, cellIdx) => (
                            <td key={cellIdx} style={{ padding: "12px", color: "#333" }}>
                              {value || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Paper>

              {/* Room Session Forms */}
              {roomSessionForms.map((form) => (
                <Paper key={form.room} sx={{ p: 3, borderRadius: 2, border: "1px solid #E0E0E0", mb: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#333" }}>
                      {form.room}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => downloadCsv(`${form.room.toLowerCase().replace(/\s+/g, "-")}-participants.csv`, csvPayload.roomSessionForms?.[form.room] || "")}
                    >
                      Download CSV
                    </Button>
                  </Box>
                  <Box sx={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #E0E0E0", backgroundColor: "#F4F7FF" }}>
                          <th style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>
                            Participant #
                          </th>
                          {form.timeSlots.map((slot) => (
                            <th key={slot} style={{ padding: "12px", textAlign: "left", fontWeight: 700, color: "#333" }}>
                              {slot}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.rows.map((row) => (
                          <tr key={row.attendeeNo} style={{ borderBottom: "1px solid #E0E0E0" }}>
                            <td style={{ padding: "12px", color: "#333", fontWeight: 600 }}>
                              {row.attendeeNo}
                            </td>
                            {form.timeSlots.map((slot) => (
                              <td key={slot} style={{ padding: "12px", color: "#333" }}>
                                {row[slot] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </Paper>
              ))}

              {/* Download All Button */}
              {roomSessionForms.length > 0 && (
                <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #E0E0E0", bgcolor: "#F4F7FF" }}>
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => downloadCsv("all-workshops-participants.csv", csvPayload.roomSessionFormsAll)}
                      sx={{ bgcolor: "#5B5BD6", "&:hover": { bgcolor: "#4A4AC0" } }}
                    >
                      Download All Workshop Reports (Combined)
                    </Button>
                  </Box>
                </Paper>
              )}
            </>
          )}

          {/* Success Toast */}
          <Snackbar
            open={successMessage !== ""}
            autoHideDuration={3000}
            onClose={() => setSuccessMessage("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <Alert onClose={() => setSuccessMessage("")} severity="success" sx={{ bgcolor: "#0EA5A6", color: "white" }}>
              {successMessage}
            </Alert>
          </Snackbar>

          {/* Clear Database Dialog */}
          <Dialog
            open={clearDialogOpen}
            onClose={() => setClearDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ color: "#d32f2f", fontWeight: 700 }}>
              ⚠️ DANGER: Clear Database
            </DialogTitle>
            <DialogContent>
              <Stack spacing={3}>
                <Alert severity="error" sx={{ fontWeight: 600 }}>
                  This action will permanently delete ALL data:
                  <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                    <li>All user registrations</li>
                    <li>All session reservations</li>
                    <li>Reset all capacities to 5</li>
                  </ul>
                  <strong>This cannot be undone!</strong>
                </Alert>

                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  To confirm, please type <strong>"I UNDERSTAND"</strong> in the box below:
                </Typography>

                <TextField
                  fullWidth
                  label="Confirmation"
                  value={clearConfirmation}
                  onChange={(e) => setClearConfirmation(e.target.value)}
                  placeholder="I UNDERSTAND"
                  error={clearConfirmation !== "" && clearConfirmation !== "I UNDERSTAND"}
                  helperText={clearConfirmation !== "" && clearConfirmation !== "I UNDERSTAND" ? "Please type exactly 'I UNDERSTAND'" : ""}
                />

                <Alert severity="info">
                  <strong>Before clearing:</strong> Backup reports will be automatically downloaded containing all current data.
                </Alert>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setClearDialogOpen(false);
                  setClearConfirmation("");
                }}
                disabled={clearingDatabase}
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearDatabase}
                variant="contained"
                color="error"
                disabled={clearConfirmation !== "I UNDERSTAND" || clearingDatabase}
                sx={{ bgcolor: "#d32f2f", "&:hover": { bgcolor: "#b71c1c" } }}
              >
                {clearingDatabase ? "Clearing..." : "Clear Database"}
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default AdminPage;
