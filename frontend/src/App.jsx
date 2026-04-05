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
import { API_BASE } from "./apiConfig";

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
  const shouldCenterCards = step !== STEPS.sessions && step !== STEPS.confirm;

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [sessions, selectedSessionIds]
  );
  const selectedSessionsByTime = useMemo(() => {
    return [...selectedSessions].sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      return a.roomId - b.roomId;
    });
  }, [selectedSessions]);

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
        throw new Error(data.error || "Oturumlar yüklenemedi.");
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
        throw new Error(data.error || "Kullanıcı kaydı başarısız.");
      }
      setUser(data);
      setSuccess("Kayıt başarıyla tamamlandı.");
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
      room: "Aynı atölye seçimi güncellendi.",
      time: "Aynı saatteki önceki seçiminiz güncellendi.",
      max: "4 seçim sınırı nedeniyle en eski seçim değiştirildi."
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
      setError("Önce kayıt olmalısınız.");
      return;
    }
    if (selectedSessionIds.length === 0) {
      setError("En az bir oturum seçiniz.");
      return;
    }
    if (selectedSessionIds.length < 4) {
      setError("Lütfen 4 saat diliminin tamamını seçiniz.");
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
          throw new Error(data.error || "Rezervasyon başarısız.");
        }
      }

      setSuccess("Rezervasyonlar tamamlandı.");
      setStep(STEPS.confirm);
    } catch (reservationError) {
      setError(reservationError.message);
      await fetchSessions();
    } finally {
      setLoading(false);
    }
  }

  function saveAsImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const safeName = `${user?.name || ""} ${user?.lastName || ""}`.trim() || "Misafir";

    const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    bgGradient.addColorStop(0, "#EEF2FF");
    bgGradient.addColorStop(1, "#ECFEFF");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1350);

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#A5B4FC";
    ctx.beginPath();
    ctx.arc(170, 170, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#67E8F9";
    ctx.beginPath();
    ctx.arc(930, 210, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const cardX = 48;
    const cardY = 110;
    const cardW = 984;
    const cardH = 1120;
    const radius = 24;

    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    ctx.shadowColor = "rgba(15,23,42,0.16)";
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    ctx.fill();
    ctx.shadowColor = "transparent";

    const contentX = 96;
    let y = 210;

    ctx.fillStyle = "#0F172A";
    ctx.font = "700 58px Inter, Arial, sans-serif";
    ctx.fillText("Atölye Onayı", contentX, y);

    y += 52;
    ctx.fillStyle = "#475569";
    ctx.font = "400 29px Inter, Arial, sans-serif";
    ctx.fillText("Randevu seçimleriniz başarıyla alındı.", contentX, y);

    y += 48;
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(contentX, y);
    ctx.lineTo(980, y);
    ctx.stroke();

    y += 66;
    ctx.fillStyle = "#334155";
    ctx.font = "600 34px Inter, Arial, sans-serif";
    ctx.fillText("Katılımcı", contentX, y);

    y += 52;
    ctx.fillStyle = "#0F172A";
    ctx.font = "600 33px Inter, Arial, sans-serif";
    ctx.fillText(safeName, contentX, y);

    y += 44;
    ctx.fillStyle = "#475569";
    ctx.font = "400 28px Inter, Arial, sans-serif";
    ctx.fillText(user?.phoneNumber || "", contentX, y);

    y += 80;
    ctx.fillStyle = "#334155";
    ctx.font = "600 34px Inter, Arial, sans-serif";
    ctx.fillText("Oturumlar (saate göre)", contentX, y);

    y += 26;
    const orderedSessions = selectedSessionsByTime;
    orderedSessions.forEach((session) => {
      y += 52;
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(contentX, y - 32, 22, 22);
      ctx.fillStyle = "#0F172A";
      ctx.font = "500 28px Inter, Arial, sans-serif";
      ctx.fillText(
        `${session.startTime}-${session.endTime}   |   ${session.roomName}`,
        contentX + 40,
        y - 12
      );
    });

    if (!orderedSessions.length) {
      y += 56;
      ctx.fillStyle = "#64748B";
      ctx.font = "400 28px Inter, Arial, sans-serif";
      ctx.fillText("Seçili oturum yok.", contentX, y);
    }

    const image = canvas.toDataURL("image/jpeg", 0.95);
    const link = document.createElement("a");
    link.download = `atolye-onayi-${user?.id || "kullanici"}.jpg`;
    link.href = image;
    link.click();
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
          minHeight: "100dvh",
          background:
            "radial-gradient(circle at top left, #E0E7FF 0%, transparent 45%), radial-gradient(circle at bottom right, #CCFBF1 0%, transparent 40%), #F4F7FF",
          py: 1.5
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            minHeight: "100dvh",
            py: 1.5,
            display: "flex",
            alignItems: shouldCenterCards ? "center" : "flex-start"
          }}
        >
          <Stack spacing={2} sx={{ width: "100%" }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.14),
            backdropFilter: "blur(12px)",
            background:
              "linear-gradient(130deg, rgba(255,255,255,0.72) 0%, rgba(238,242,255,0.64) 100%)",
            boxShadow: "0 18px 36px rgba(30, 41, 59, 0.10)"
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Avatar
              sx={{
                bgcolor: "primary.main",
                width: 46,
                height: 46,
                boxShadow: "0 8px 20px rgba(91, 91, 214, 0.45)"
              }}
            >
              Bil
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                Bil Koleji Florya 23 Nisan Atölye Sistemi
              </Typography>
              <Typography color="text.secondary" fontSize={14}>
                23 Nisan etkinliği için atölye seçim platformu.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.1),
            background: alpha("#FFFFFF", 0.72),
            backdropFilter: "blur(10px)"
          }}
        >
          <Stepper activeStep={activeStep} alternativeLabel>
            <Step>
              <StepLabel>Hoş Geldiniz</StepLabel>
            </Step>
            <Step>
              <StepLabel>Bilgiler</StepLabel>
            </Step>
            <Step>
              <StepLabel>Telefon</StepLabel>
            </Step>
            <Step>
              <StepLabel>Oturumlar</StepLabel>
            </Step>
            <Step>
              <StepLabel>Onay</StepLabel>
            </Step>
          </Stepper>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        {step === STEPS.intro && (
          <Card
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack spacing={2.5}>
                <Typography variant="h5" fontWeight={700}>
                  Hoş Geldiniz
                </Typography>
                <Typography color="text.secondary">
                  Sayın misafirimiz, Bil Koleji Florya&apos;nın 23 Nisan Çocuk Bayramı
                  etkinliğine hoş geldiniz.
                  <br />
                  <br />
                  Atölyelerimiz saat 11.30 ile 13.30 arasında gerçekleştirilecektir.
                  <br />
                  6 atölye arasından 4 tanesini seçebilirsiniz.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Chip label="6 Atölye" color="primary" />
                  <Chip label="4 Saat Dilimi" color="secondary" />
                  <Chip label="4 Seçim Hakkı" />
                </Stack>
                <Button
                  variant="contained"
                  size="large"
                  sx={{ py: 1.2, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                  onClick={() => setStep(STEPS.userInfo)}
                >
                  Kayda Başla
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.userInfo && (
          <Card
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Kişisel Bilgiler
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    fullWidth
                    label="Ad"
                    value={userInfo.name}
                    onChange={(event) =>
                      setUserInfo((prev) => ({ ...prev, name: event.target.value }))
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  />
                  <TextField
                    fullWidth
                    label="Soyad"
                    value={userInfo.lastName}
                    onChange={(event) =>
                      setUserInfo((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  />
                  <TextField
                    fullWidth
                    label="Yaş"
                    type="number"
                    value={userInfo.age}
                    onChange={(event) =>
                      setUserInfo((prev) => ({ ...prev, age: event.target.value }))
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  />
                </Stack>
                <Button
                  variant="contained"
                  size="large"
                  sx={{ py: 1.2, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                  onClick={() => setStep(STEPS.phone)}
                  disabled={!userInfo.name || !userInfo.lastName || !userInfo.age}
                >
                  Devam Et
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.phone && (
          <Card
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Telefon Numarası
                </Typography>
                <TextField
                  label="Telefon Numarası"
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
                  {loading ? "Kaydediliyor..." : "Kaydı Tamamla"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.sessions && (
          <Card
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack spacing={3}>
                <Typography variant="h6" fontWeight={700}>
                  Atölye Seçimi
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  4 oturum seçmeniz zorunludur. Her atölyeden yalnızca bir kez
                  seçim yapabilirsiniz.
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ width: "100%", alignItems: { xs: "stretch", sm: "center" } }}
                >
                  <Chip
                    label={`Seçilen: ${selectedSessionIds.length} / 4`}
                    color="primary"
                    sx={{
                      width: { xs: "100%", sm: "auto" },
                      "& .MuiChip-label": { width: "100%", textAlign: "center" }
                    }}
                  />
                  <Chip
                    label="Her atölyeden tek seçim"
                    variant="outlined"
                    sx={{
                      width: { xs: "100%", sm: "auto" },
                      "& .MuiChip-label": { width: "100%", textAlign: "center" }
                    }}
                  />
                  <Chip
                    label="4 oturum zorunlu"
                    variant="outlined"
                    color="warning"
                    sx={{
                      width: { xs: "100%", sm: "auto" },
                      "& .MuiChip-label": { width: "100%", textAlign: "center" }
                    }}
                  />
                </Stack>
                {timeKeys.map((timeKey) => (
                  <Paper
                    key={timeKey}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
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
                          <Grid item xs={12} md={6} key={session.id}>
                            <Button
                              fullWidth
                              variant={selected ? "contained" : "outlined"}
                              color={session.isFull ? "error" : "primary"}
                              onClick={() => toggleSession(session)}
                              disabled={disabled || loading}
                              sx={{
                                px: 2,
                                py: 1.5,
                                borderRadius: 3,
                                textAlign: "left"
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1.5}
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ width: "100%", minWidth: 0 }}
                              >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography
                                    component="span"
                                    sx={{
                                      display: "block",
                                      fontWeight: 700,
                                      lineHeight: 1.35,
                                      whiteSpace: "normal",
                                      pr: 1
                                    }}
                                  >
                                    {session.roomName}
                                  </Typography>
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{ display: "block", mt: 0.5, opacity: 0.9 }}
                                  >
                                    {selected
                                      ? "Seçildi"
                                      : session.isFull
                                        ? "Kontenjan dolu"
                                        : "Uygun oturum"}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={session.isFull ? "Dolu" : `${session.availableSpots} boş`}
                                  color={session.isFull ? "error" : selected ? "secondary" : "default"}
                                  variant={selected ? "filled" : "outlined"}
                                  sx={{ flexShrink: 0 }}
                                />
                              </Stack>
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
                  disabled={loading || selectedSessionIds.length < 4}
                >
                  {loading ? "Kaydediliyor..." : "Rezervasyonu Onayla"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {step === STEPS.confirm && (
          <Card
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.14),
              background: alpha("#FFFFFF", 0.74),
              backdropFilter: "blur(10px)",
              boxShadow: "0 20px 36px rgba(15, 23, 42, 0.09)"
            }}
          >
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <Stack spacing={2.5}>
                <Typography variant="h6" fontWeight={700}>
                  Onay
                </Typography>
                <Typography>
                  Ad Soyad: {user?.name} {user?.lastName}
                </Typography>
                <Typography>Telefon: {user?.phoneNumber}</Typography>
                <Divider />
                <Typography variant="subtitle1">Seçilen Oturumlar</Typography>
                {selectedSessionsByTime.map((session) => (
                  <Chip
                    key={session.id}
                    label={`${session.startTime}-${session.endTime} | ${session.roomName}`}
                    variant="outlined"
                    sx={{
                      height: "auto",
                      "& .MuiChip-label": {
                        display: "block",
                        whiteSpace: "normal",
                        py: 0.75
                      }
                    }}
                  />
                ))}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="contained"
                    sx={{ py: 1.1, boxShadow: "0 10px 20px rgba(91, 91, 214, 0.4)" }}
                    onClick={saveAsImage}
                  >
                    Onayı JPG Olarak İndir
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={exitToIntro}>
                    Çıkış
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
