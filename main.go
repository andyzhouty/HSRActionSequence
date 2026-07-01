package main

import (
	"context"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:dist
var assets embed.FS

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func (a *App) ReadTextFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) WriteTextFile(path string, contents string) error {
	return os.WriteFile(path, []byte(contents), 0644)
}

func (a *App) WritePngFile(path string, dataUrl string) error {
	const prefix = "data:image/png;base64,"
	if len(dataUrl) < len(prefix) || dataUrl[:len(prefix)] != prefix {
		return fmt.Errorf("not a PNG data URL")
	}
	contents, err := base64.StdEncoding.DecodeString(dataUrl[len(prefix):])
	if err != nil {
		return err
	}
	if len(contents) < 8 || contents[0] != 0x89 || contents[1] != 0x50 || contents[2] != 0x4E || contents[3] != 0x47 {
		return fmt.Errorf("not valid PNG data")
	}
	return os.WriteFile(path, contents, 0644)
}

func (a *App) WriteBase64File(path string, dataBase64 string) error {
	contents, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return fmt.Errorf("base64 decode failed: %w", err)
	}
	return os.WriteFile(path, contents, 0644)
}

// SaveFileDialog opens a save dialog
func (a *App) SaveFileDialog(optionsJSON string) (string, error) {
	var opts struct {
		Title           string `json:"title"`
		DefaultFilename string `json:"defaultFilename"`
		Filters         []struct {
			DisplayName string `json:"displayName"`
			Pattern     string `json:"pattern"`
		} `json:"filters"`
	}
	if optionsJSON != "" {
		json.Unmarshal([]byte(optionsJSON), &opts)
	}
	dialogOpts := runtime.SaveDialogOptions{Title: opts.Title, DefaultFilename: opts.DefaultFilename}
	for _, f := range opts.Filters {
		dialogOpts.Filters = append(dialogOpts.Filters, runtime.FileFilter{
			DisplayName: f.DisplayName, Pattern: f.Pattern,
		})
	}
	return runtime.SaveFileDialog(a.ctx, dialogOpts)
}

// OpenFileDialog opens an open dialog
func (a *App) OpenFileDialog(optionsJSON string) (string, error) {
	var opts struct {
		Title   string `json:"title"`
		Filters []struct {
			DisplayName string `json:"displayName"`
			Pattern     string `json:"pattern"`
		} `json:"filters"`
	}
	if optionsJSON != "" {
		json.Unmarshal([]byte(optionsJSON), &opts)
	}
	dialogOpts := runtime.OpenDialogOptions{Title: opts.Title}
	for _, f := range opts.Filters {
		dialogOpts.Filters = append(dialogOpts.Filters, runtime.FileFilter{
			DisplayName: f.DisplayName, Pattern: f.Pattern,
		})
	}
	return runtime.OpenFileDialog(a.ctx, dialogOpts)
}

func (a *App) GetAutosavePath() string {
	appDir, err := os.UserConfigDir()
	if err != nil {
		appDir = filepath.Join(os.TempDir(), "hsractionsequence")
	}
	appDir = filepath.Join(appDir, "hsractionsequence")
	os.MkdirAll(appDir, 0755)
	return filepath.Join(appDir, "action-sequence-autosave.json")
}

func main() {
	app := NewApp()
	err := wails.Run(&options.App{
		Title:  "星穹铁道排轴工具",
		Width:  800,
		Height: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: nil,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err.Error())
	}
}
