// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/beeper/desktop-api-cli/internal/mocktest"
)

func TestAssetsDownload(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"assets", "download",
			"--url", "mxc://example.org/Q4x9CqGz1pB3Oa6XgJ",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("url: mxc://example.org/Q4x9CqGz1pB3Oa6XgJ")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"assets", "download",
		)
	})
}

func TestAssetsServe(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"assets", "serve",
			"--url", "x",
		)
	})
}

func TestAssetsUpload(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"assets", "upload",
			"--file", "Example data",
			"--file-name", "fileName",
			"--mime-type", "mimeType",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"file: Example data\n" +
			"fileName: fileName\n" +
			"mimeType: mimeType\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"assets", "upload",
		)
	})
}

func TestAssetsUploadBase64(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--access-token", "string",
			"assets", "upload-base64",
			"--content", "x",
			"--file-name", "fileName",
			"--mime-type", "mimeType",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"content: x\n" +
			"fileName: fileName\n" +
			"mimeType: mimeType\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--access-token", "string",
			"assets", "upload-base64",
		)
	})
}
