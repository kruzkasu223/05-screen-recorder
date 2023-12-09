import "./style.css"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

const loader = document.getElementById("loading")
const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm"
const getConfig = async () => ({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
})
const ffmpeg = new FFmpeg()
getConfig()
  .then((values) => {
    ffmpeg
      .load(values)
      .then((loaded) => {
        if (loader) loader.style.display = "none"
        if (!loaded) mp4RadioButton?.setAttribute("disabled", "true")
      })
      .catch((error) => {
        if (loader) loader.style.display = "none"
        console.error(error)
        mp4RadioButton?.setAttribute("disabled", "true")
      })
  })
  .catch((error) => {
    console.error(error)
    mp4RadioButton?.setAttribute("disabled", "true")
  })

const startButton = document.getElementById("start")
const stopButton = document.getElementById("stop")
const downloadButton = document.getElementById("download")
const webmRadioButton = document.getElementById(
  "webm"
) as HTMLInputElement | null
const mp4RadioButton = document.getElementById("mp4") as HTMLInputElement | null
const videoElement = document.getElementById("video") as HTMLVideoElement

let stream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let streamBlob: Blob[] = []
let videoStartTime: number | null = null
let videoDuration: number | null = null
let videoFrames: number | null = null
let videoCompletedPercentage: string | null = null
let videoDownloadType: "webm" | "mp4" = "webm"
let videoBlobUrlMP4: string | null = null
let videoBlobUrlWEBM: string | null = null

const clearCachedStreams = () => {
  stream = null
  mediaRecorder = null
  streamBlob = []
  videoStartTime = null
  videoDuration = null
  videoFrames = null
  videoCompletedPercentage = null
  videoBlobUrlMP4 && window.URL.revokeObjectURL(videoBlobUrlMP4)
  videoBlobUrlMP4 = null
  videoBlobUrlWEBM && window.URL.revokeObjectURL(videoBlobUrlWEBM)
  videoBlobUrlWEBM = null
}

const startRecording = async () => {
  clearCachedStreams()

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    })
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.start()
    videoStartTime = new Date().getTime()
    mediaRecorder.ondataavailable = (e) => {
      streamBlob.push(e.data)
    }
    videoElement.srcObject = stream

    startButton?.setAttribute("disabled", "true")
    stopButton?.removeAttribute("disabled")
    downloadButton?.setAttribute("disabled", "true")

    const tracks = stream?.getTracks()
    tracks?.forEach((track) => {
      track.addEventListener("ended", stopRecording)
    })
  } catch (error) {
    console.error(error)
    clearCachedStreams()
    alert(error)
  }
}

const stopRecording = () => {
  const tracks = stream?.getTracks()
  mediaRecorder?.stop()

  if (videoStartTime)
    videoDuration = (new Date().getTime() - videoStartTime) / 1000

  tracks?.forEach((track) => track.stop())
  videoElement.srcObject = null

  startButton?.removeAttribute("disabled")
  stopButton?.setAttribute("disabled", "true")
  downloadButton?.removeAttribute("disabled")
}

const getFPS = (message: string) => {
  const fpsMatch = message.match(/(\d+(\.\d+)?) fps/)
  if (fpsMatch) {
    return parseFloat(fpsMatch?.[1])
  }
  return 0
}

const getConvertedFrames = (message: string) => {
  const frameMatch = message.match(/frame=\s*(\d+)/)
  if (frameMatch) {
    return parseInt(frameMatch[1])
  }
  return 0
}

const transcodeToMP4 = async (webmBlob: Blob) => {
  ffmpeg.on("log", ({ message }) => {
    if (!videoDuration) return
    if (message.startsWith("  Stream") && message.includes("fps")) {
      const fps = getFPS(message)
      videoFrames = Math.ceil(videoDuration * fps)
    }
    if (videoFrames && message.startsWith("frame")) {
      const convertedFrames = getConvertedFrames(message)
      const completedPercentage = (convertedFrames / videoFrames) * 100
      videoCompletedPercentage =
        completedPercentage > 100
          ? (100).toFixed(2)
          : completedPercentage.toFixed(2)
    }
  })

  ffmpeg.on("progress", ({ progress }) => {
    if (!downloadButton) return

    if (progress !== 1) {
      downloadButton?.setAttribute("disabled", "true")
      startButton?.setAttribute("disabled", "true")
      downloadButton.innerText = `Downloading... ${
        videoCompletedPercentage ? videoCompletedPercentage + "%" : ""
      }`
      return
    }

    startButton?.removeAttribute("disabled")
    downloadButton?.removeAttribute("disabled")
    downloadButton.innerText = "Download Recording"
  })

  await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob))
  await ffmpeg.exec(["-i", "input.webm", "output.mp4"])
  const data = await ffmpeg.readFile("output.mp4")
  // @ts-expect-error ts(2339)
  return URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }))
}

const downloadRecording = async () => {
  webmRadioButton?.setAttribute("disabled", "true")
  mp4RadioButton?.setAttribute("disabled", "true")

  const videoBlob = new Blob(streamBlob, {
    type: "video/webm",
  })

  if (videoDownloadType === "mp4") {
    if (!videoBlobUrlMP4) videoBlobUrlMP4 = await transcodeToMP4(videoBlob)
  }
  if (!videoBlobUrlWEBM) videoBlobUrlWEBM = URL.createObjectURL(videoBlob)
  if (!videoBlobUrlMP4 && !videoBlobUrlWEBM) return

  const downloadAnchor = document.createElement("a")
  document.body.appendChild(downloadAnchor)
  downloadAnchor.style.display = "none"
  downloadAnchor.href =
    videoDownloadType === "mp4" && videoBlobUrlMP4
      ? videoBlobUrlMP4
      : videoBlobUrlWEBM
  downloadAnchor.download = `screen-recording-${new Date().toISOString()}.${videoDownloadType}`
  downloadAnchor.click()

  webmRadioButton?.removeAttribute("disabled")
  mp4RadioButton?.removeAttribute("disabled")
}

startButton?.addEventListener("click", startRecording)
stopButton?.addEventListener("click", stopRecording)
downloadButton?.addEventListener("click", downloadRecording)
webmRadioButton?.addEventListener("click", () => (videoDownloadType = "webm"))
mp4RadioButton?.addEventListener("click", () => (videoDownloadType = "mp4"))
