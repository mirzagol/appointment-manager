import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Stack,
  TextField,
  ThemeProvider,
  Typography
} from "@mui/material";
import { alpha, createTheme } from "@mui/material/styles";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const STEPS = {
  intro: "intro",
  userInfo: "userInfo",
  phone: "phone",
  sessions: "sessions",
  confirm: "confirm"
};

const STEP_ORDER = [
  STEPS.intro,
  STEPS.userInfo,
  STEPS.phone,
  STEPS.sessions,
  STEPS.confirm
];

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
  shape: { borderRadius: 18 },
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

function App() {
  const [step, setStep] = useState(STEPS.intro);
  const [userInfo, setUserInfo] = useState({
    name: "",
    lastName: "",
    age: ""
  });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const activeStep = STEP_ORDER.indexOf(step);

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [sessions, selectedSessionIds]
  );

  const sessionsByTime = useMemo(() => {
    const grouped = {};
    for (const session of sessions) {
      const key = `${session.startTime}-${session.endTime}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(session);
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.roomId - b.roomId);
    }
    return grouped;
  }, [sessions]);

  const timeKeys = useMemo(() => Object.keys(sessionsByTime), [sessionsByTime]);
  const selectedRoomIds = useMemo(
    () => new Set(selectedSessions.map((session) => session.roomId)),
    [selectedSessions]
  );

  useEffect(() => {
    if (step === STEPS.sessions) {
      fetchSessions();
    }
  }, [step]);

  async function fetchSessions() {
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load sessions.");
      }
      setSessions(data.sessions);
    } catch (fetchError) {
      setError(fetchError.message);
    }
  }

  async function createUser() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userInfo,
          age: Number(userInfo.age),
          phoneNumber
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "User registration failed.");
      }
      setUser(data);
      setSuccess("User registered successfully.");
      setStep(STEPS.sessions);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setLoading(false);
    }
  }

  function replaceSelection(nextSession, reason) {
    const byId = new Map(sessions.map((session) => [session.id, session]));
    let updatedSelectionIds = [...selectedSessionIds];
    const reasonMessage = {
      room: "Selection updated: replaced your previous choice for this room.",
      time: "Selection updated: replaced your previous choice in this time slot.",
      max: "Selection updated: replaced your earliest pick to keep 4 selections."
    };

    if (reason === "room") {
      updatedSelectionIds = updatedSelectionIds.filter((id) => {
        const selectedSession = byId.get(id);
        return selectedSession?.roomId !== nextSession.roomId;
      });
    }
    if (reason === "time") {
      updatedSelectionIds = updatedSelectionIds.filter((id) => {
        const selectedSession = byId.get(id);
        return !(
          selectedSession?.startTime === nextSession.startTime &&
          selectedSession?.endTime === nextSession.endTime
        );
      });
    }
    if (reason === "max") {
      updatedSelectionIds = updatedSelectionIds.slice(1);
    }

    updatedSelectionIds = updatedSelectionIds.filter((id) => id !== nextSession.id);
    updatedSelectionIds.push(nextSession.id);
    setSelectedSessionIds(updatedSelectionIds);
    setSuccess(reasonMessage[reason]);
  }

  function toggleSession(targetSession) {
    setError("");
    setSuccess("");
    const isSelected = selectedSessionIds.includes(targetSession.id);
    if (isSelected) {
      setSelectedSessionIds((prev) => prev.filter((id) => id !== targetSession.id));
      return;
    }

    const existingSameRoom = selectedSessions.find((session) => {
      return session.roomId === targetSession.roomId && session.id !== targetSession.id;
    });
    if (existingSameRoom) {
      replaceSelection(targetSession, "room");
      return;
    }

    const existingSameTime = selectedSessions.find(
      (session) =>
        session.startTime === targetSession.startTime &&
        session.endTime === targetSession.endTime
    );
    if (existingSameTime) {
      replaceSelection(targetSession, "time");
      return;
    }

    if (selectedSessionIds.length >= 4) {
      replaceSelection(targetSession, "max");
      return;
    }

    setSelectedSessionIds((prev) => [...prev, targetSession.id]);
  }

  async function submitReservations() {
    if (!user) {
      setError("User registration is required.");
      return;
    }
    if (selectedSessionIds.length === 0) {
      setError("Select at least one session.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      for (const sessionId of selectedSessionIds) {
        const response = await fetch(`${API_BASE}/reservations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            sessionId
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Booking failed.");
        }
      }

      setSuccess("Reservations completed.");
      setStep(STEPS.confirm);
    } catch (reservationError) {
      setError(reservationError.message);
      await fetchSessions();
    } finally {
      setLoading(false);
    }
  }

  function saveAsImage() {
    const safeName = `${user?.name || ""} ${user?.lastName || ""}`.trim() || "Guest";
    const rows = selectedSessions
      .map((session) => {
        return `<tspan x="40" dy="28">${session.roomName} - ${session.startTime} to ${session.endTime}</tspan>`;
      })
      .join("");

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#EEF2FF"/>
            <stop offset="100%" stop-color="#ECFEFF"/>
          </linearGradient>
          <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.96"/>
            <stop offset="100%" stop-color="#F8FAFC" stop-opacity="0.93"/>
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#64748B" flood-opacity="0.22"/>
          </filter>
        </defs>
        <rect width="1080" height="1350" fill="url(#bg)"/>
        <circle cx="130" cy="150" r="220" fill="#A5B4FC" fill-opacity="0.16"/>
        <circle cx="930" cy="260" r="280" fill="#67E8F9" fill-opacity="0.16"/>
        <rect x="40" y="120" width="1000" height="1080" rx="38" fill="url(#card)" filter="url(#shadow)"/>
        <text x="80" y="220" font-size="54" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#1E293B">Event Confirmation</text>
        <text x="80" y="275" font-size="30" font-family="Inter, Arial, sans-serif" fill="#475569">Your booking has been recorded.</text>
        <line x1="80" y1="320" x2="1000" y2="320" stroke="#CBD5E1" stroke-width="2"/>
        <text x="80" y="390" font-size="32" font-family="Inter, Arial, sans-serif" font-weight="600" fill="#334155">Participant</text>
        <text x="80" y="440" font-size="30" font-family="Inter, Arial, sans-serif" fill="#0F172A">${safeName}</text>
        <text x="80" y="490" font-size="27" font-family="Inter, Arial, sans-serif" fill="#475569">${user?.phoneNumber || ""}</text>
        <text x="80" y="580" font-size="32" font-family="Inter, Arial, sans-serif" font-weight="600" fill="#334155">Sessions</text>
        <text y="620" font-size="28" font-family="Inter, Arial, sans-serif" fill="#0F172A">
          ${rows || '<tspan x="40" dy="28">No sessions selected.</tspan>'}
        </text>
      </svg>
    `;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const image = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `appointment-confirmation-${user?.id || "user"}.svg`;
    link.href = image;
    link.click();
    URL.revokeObjectURL(image);
  }

  function exitToIntro() {
    setStep(STEPS.intro);
    setUserInfo({ name: "", lastName: "", age: "" });
    setPhoneNumber("");
    setUser(null);
    setSessions([]);
    setSelectedSessionIds([]);
    setError("");
    setSuccess("");
    setLoading(false);
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, #E0E7FF 0%, transparent 45%), radial-gradient(circle at bottom right, #CCFBF1 0%, transparent 40%), #F4F7FF",
          py: 2
        }}
      >
        <Container maxWidth="sm" sx={{ py: 2 }}>
          <Stack spacing={2}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 5,
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.14),
            backdropFilter: "blur(12px)",
            background:
              "linear-gradient(130deg, rgba(255,255,255,0.72) 0%, rgba(238,242,255,0.64) 100%)",
            boxShadow: "0 18px 36px rgba(30, 41, 59, 0.10)"
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              sx={{
                bgcolor: "primary.main",
                width: 46,
                height: 46,
                boxShadow: "0 8px 20px rgba(91, 91, 214, 0.45)"
              }}
            >
              EV
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Event Appointment Manager
              </Typography>
              <Typography color="text.secondary" fontSize={14}>
                Phone-first booking for your one-day event.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 5,
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.1),
            background: alpha("#FFFFFF", 0.72),
            backdropFilter: "blur(10px)"
          }}
        >
          <Stepper activeStep={activeStep} alternativeLabel>
            <Step>
              <StepLabel>Welcome</StepLabel>
            </Step>
            <Step>
              <StepLabel>Profile</StepLabel>
            </Step>
            <Step>
              <StepLabel>Phone</StepLabel>
            </Step>
            <Step>
              <StepLabel>Sessions</StepLabel>
            </Step>
            <Step>
              <StepLabel>Confirm</StepLabel>
            </Step>
          </Stepper>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {step === STEPS.intro && (
          <Card
            sx={{
              borderRadius: 5,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h5" fontWeight={700}>
                  Welcome
                </Typography>
                <Typography color="text.secondary">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Please
                  complete your information and choose your preferred sessions.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Chip label="6 Rooms" color="primary" />
                  <Chip label="4 Time Slots" color="secondary" />
                  <Chip label="Max 4 Selections" />
                </Stack>
                <Button
                  variant="contained"
                  size="large"
                  sx={{ py: 1.2, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                  onClick={() => setStep(STEPS.userInfo)}
                >
                  Start Registration
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.userInfo && (
          <Card
            sx={{
              borderRadius: 5,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Personal Information
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={userInfo.name}
                      onChange={(event) =>
                        setUserInfo((prev) => ({ ...prev, name: event.target.value }))
                      }
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      value={userInfo.lastName}
                      onChange={(event) =>
                        setUserInfo((prev) => ({ ...prev, lastName: event.target.value }))
                      }
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Age"
                      type="number"
                      value={userInfo.age}
                      onChange={(event) =>
                        setUserInfo((prev) => ({ ...prev, age: event.target.value }))
                      }
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                    />
                  </Grid>
                </Grid>
                <Button
                  variant="contained"
                  size="large"
                  sx={{ py: 1.2, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                  onClick={() => setStep(STEPS.phone)}
                  disabled={!userInfo.name || !userInfo.lastName || !userInfo.age}
                >
                  Continue
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.phone && (
          <Card
            sx={{
              borderRadius: 5,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Phone Number
                </Typography>
                <TextField
                  label="Phone Number"
                  fullWidth
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                />
                <Button
                  variant="contained"
                  size="large"
                  sx={{ py: 1.2, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                  onClick={createUser}
                  disabled={!phoneNumber || loading}
                >
                  {loading ? "Registering..." : "Create User"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.sessions && (
          <Card
            sx={{
              borderRadius: 5,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Select Sessions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pick up to 4 sessions. Each room can only be selected once overall.
                  When a room is selected in one slot, that room is disabled in all others.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Chip label={`Selected: ${selectedSessionIds.length} / 4`} color="primary" />
                  <Chip label="Unique room across all slots" variant="outlined" />
                </Stack>
                {timeKeys.map((timeKey) => (
                  <Paper
                    key={timeKey}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      borderColor: alpha(theme.palette.primary.main, 0.18),
                      background: alpha("#FFFFFF", 0.75)
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                      {timeKey.replace("-", " - ")}
                    </Typography>
                    <Grid container spacing={1.5}>
                      {sessionsByTime[timeKey].map((session) => {
                        const selected = selectedSessionIds.includes(session.id);
                        const roomTakenElsewhere =
                          selectedRoomIds.has(session.roomId) && !selected;
                        const disabled = (session.isFull && !selected) || roomTakenElsewhere;
                        return (
                          <Grid item xs={12} sm={6} key={session.id}>
                            <Button
                              fullWidth
                              variant={selected ? "contained" : "outlined"}
                              color={session.isFull ? "error" : "primary"}
                              onClick={() => toggleSession(session)}
                              disabled={disabled || loading}
                              sx={{
                                py: 1.2,
                                justifyContent: "space-between",
                                borderRadius: 3
                              }}
                            >
                              {session.roomName} - {session.availableSpots} left
                            </Button>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                ))}
                <Button
                  variant="contained"
                  size="large"
                  sx={{ py: 1.2, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                  onClick={submitReservations}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Confirm Reservations"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.confirm && (
          <Card
            sx={{
              borderRadius: 5,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h6" fontWeight={700}>
                  Confirmation
                </Typography>
                <Typography>
                  Name: {user?.name} {user?.lastName}
                </Typography>
                <Typography>Phone: {user?.phoneNumber}</Typography>
                <Divider />
                <Typography variant="subtitle1">Booked Sessions</Typography>
                {selectedSessions.map((session) => (
                  <Chip
                    key={session.id}
                    label={`${session.roomName} | ${session.startTime}-${session.endTime}`}
                    variant="outlined"
                  />
                ))}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="contained"
                    sx={{ py: 1.1, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                    onClick={saveAsImage}
                  >
                    Download Confirmation
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={exitToIntro}>
                    Exit
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
