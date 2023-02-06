import "./style.css"

const startButton = document.getElementById("start")
const stopButton = document.getElementById("stop")
const downloadButton = document.getElementById("download")
const videoElement = document.getElementById("video") as HTMLVideoElement

let stream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
const streamBlob: Blob[] = []

const startRecording = async () => {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    })
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.start()
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
    alert(error)
    console.error(error)
  }
}

const stopRecording = () => {
  const tracks = stream?.getTracks()
  mediaRecorder?.stop()
  tracks?.forEach((track) => track.stop())
  videoElement.srcObject = null

  startButton?.removeAttribute("disabled")
  stopButton?.setAttribute("disabled", "true")
  downloadButton?.removeAttribute("disabled")
}

const downloadRecording = () => {
  const videoBlob = new Blob(streamBlob, {
    type: "video/webm",
  })
  const blobUrl = URL.createObjectURL(videoBlob)

  const downloadAnchor = document.createElement("a")
  document.body.appendChild(downloadAnchor)
  downloadAnchor.style.display = "none"
  downloadAnchor.href = blobUrl
  downloadAnchor.download = "screen-recording.webm"
  downloadAnchor.click()

  window.URL.revokeObjectURL(blobUrl)
}

startButton?.addEventListener("click", startRecording)
stopButton?.addEventListener("click", stopRecording)
downloadButton?.addEventListener("click", downloadRecording)
