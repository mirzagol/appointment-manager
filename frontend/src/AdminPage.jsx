import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
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
  const [authHeader, setAuthHeader] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [peopleBySession, setPeopleBySession] = useState([]);
  const [roomSessionForms, setRoomSessionForms] = useState([]);
  const [csvPayload, setCsvPayload] = useState({
    peopleBySession: "",
    roomSessionForms: {},
    roomSessionFormsAll: ""
  });

  const isLoggedIn = Boolean(authHeader);
  const peopleColumns = useMemo(() => {
    if (!peopleBySession.length) {
      return [];
    }
    return Object.keys(peopleBySession[0]);
  }, [peopleBySession]);
  async function loginAndLoadReports() {
    setError("");
    if (username !== "admin" || password !== "admin") {
      setError("Invalid credentials.");
      return;
    }
    setLoading(true);
    try {
      const encoded = btoa(`${username}:${password}`);
      const response = await fetch(`${API_BASE}/admin/reports`, {
        headers: {
          Authorization: `Basic ${encoded}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to login.");
      }
      setAuthHeader(`Basic ${encoded}`);
      setPeopleBySession(data.peopleBySession || []);
      setRoomSessionForms(data.roomSessionForms || []);
      setCsvPayload(
        data.csv || { peopleBySession: "", roomSessionForms: {}, roomSessionFormsAll: "" }
      );
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100dvh", backgroundColor: "#f6f8ff", py: 2 }}>
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h5" fontWeight={700}>
                  Admin Reports
                </Typography>
                <Typography color="text.secondary">
                  URL-only page for CSV exports.
                </Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {!isLoggedIn && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      label="Username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button
                      variant="contained"
                      onClick={loginAndLoadReports}
                      disabled={!username || !password || loading}
                    >
                      {loading ? "Loading..." : "Login"}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {isLoggedIn && (
            <>
              <Card>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1}
                    >
                      <Typography variant="h6">People with Selected Rooms by Session</Typography>
                      <Button
                        variant="outlined"
                        onClick={() =>
                          downloadCsv("people-by-session.csv", csvPayload.peopleBySession)
                        }
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {peopleColumns.map((column) => (
                              <TableCell key={column}>{column}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {peopleBySession.map((row) => (
                            <TableRow key={row.userId}>
                              {peopleColumns.map((column) => (
                                <TableCell key={column}>{row[column]}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                </CardContent>
              </Card>

              {roomSessionForms.map((form) => (
                <Card key={form.room}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1}
                      >
                        <Typography variant="h6">{form.room} - People Per Session</Typography>
                        <Button
                          variant="outlined"
                          onClick={() =>
                            downloadCsv(
                              `${form.room.toLowerCase().replace(/\s+/g, "-")}-sessions.csv`,
                              csvPayload.roomSessionForms?.[form.room] || ""
                            )
                          }
                        >
                          Export CSV
                        </Button>
                      </Stack>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Attendee #</TableCell>
                              {form.timeSlots.map((slot) => (
                                <TableCell key={slot}>{slot}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {form.rows.map((row) => (
                              <TableRow key={`${form.room}-${row.attendeeNo}`}>
                                <TableCell>{row.attendeeNo}</TableCell>
                                {form.timeSlots.map((slot) => (
                                  <TableCell key={slot}>{row[slot]}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                  >
                    <Typography variant="h6">All Room Session Forms (Single CSV)</Typography>
                    <Button
                      variant="contained"
                      onClick={() =>
                        downloadCsv(
                          "all-room-session-forms.csv",
                          csvPayload.roomSessionFormsAll || ""
                        )
                      }
                    >
                      Export All CSV
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

export default AdminPage;
