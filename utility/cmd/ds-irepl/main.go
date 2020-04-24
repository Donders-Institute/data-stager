package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"

	putil "github.com/Donders-Institute/data-stager/utility/pkg/path"

	pb "github.com/schollz/progressbar/v2"
)

var optsVerbose *bool
var optsProgressBar *bool
var optsRescSrc *string
var optsRescDst *string
var optsDryrun *bool

func init() {
	optsVerbose = flag.Bool("v", false, "print debug messages")
	optsProgressBar = flag.Bool("p", false, "show progress bar")
	optsRescSrc = flag.String("S", "resc_dccn", "iRODS resource name as data source")
	optsRescDst = flag.String("R", "resc_loc", "iRODS resource name as data destination")
	optsDryrun = flag.Bool("d", false, "dry run. Only list actions to be performed.  It is useful for debug purpose.")

	flag.Usage = usage
	flag.Parse()

	log.SetOutput(os.Stderr)
	llevel := log.InfoLevel
	if *optsVerbose || *optsDryrun {
		llevel = log.DebugLevel
	}

	log.SetLevel(llevel)
}

func usage() {
	fmt.Printf("\nReplicate collection from one iRODS resource to another.\n")
	fmt.Printf("\nUSAGE: %s [OPTIONS] {path_coll}\n", os.Args[0])
	fmt.Printf("\nOPTIONS:\n")
	flag.PrintDefaults()
	fmt.Printf("\n")
}

func main() {

	if flag.NArg() < 1 {
		flag.Usage()
		log.Fatal("insufficient arguments.")
	}

	// get collection from argument
	coll := flag.Args()[0]

	// append the prefix `i:` to get path information from iRODS.
	collPathInfo, err := GetPathInfo(fmt.Sprintf("i:%s", coll))
	if err != nil {
		log.Fatal(err)
	}

	log.Debugf("collection or data path info: %+v\n", collPathInfo)

	// get number of files at source
	nf, err := GetNumberOfFiles(collPathInfo)
	if err != nil {
		log.Fatal(err)
	}

	if nf == 0 {
		log.Warnf("nothing to sync: %s\n", coll)
		os.Exit(0)
	}

	// progress bar
	bar := pb.NewOptions(nf,
		pb.OptionSetPredictTime(false),
		pb.OptionSetTheme(pb.Theme{
			Saucer:        "#",
			SaucerPadding: "-",
			BarStart:      "[",
			BarEnd:        "]",
		}),
	)
	if *optsProgressBar {
		bar.RenderBlank()
	}

	success, failure := ScanAndRepl(collPathInfo, *optsRescSrc, *optsRescDst, 4)

	c := 0
	ec := 0
	for {
		select {
		case _, ok := <-success:
			if !ok {
				success = nil
			} else {
				// increase the counter by 1, and write progress to stdout
				c++
				if *optsProgressBar {
					bar.Add(1)
				} else {
					fmt.Printf("progress:%d:%d:%d\n", c*100./nf, c, nf)
				}
			}
		case e, ok := <-failure:
			if !ok {
				failure = nil
			} else {
				ec = 2
				// write error to the stderr
				log.Errorf("failure: %s\n", e.Error)
			}
		default:
			// this dummy progress string is printed to circumvent stager job killing due to timeout_noprocess (3600 sec.) is reached.
			if !*optsProgressBar && c == 0 {
				// sleep for a second.
				time.Sleep(time.Second)
				// keep printing progress value while there is still nothing reported back from the irsync scan.
				fmt.Printf("progress:%d:%d:%d\n", c*100./nf, c, nf)
			}
		}

		if success == nil && failure == nil {
			log.Debugln("finish")
			break
		}
	}

	// return exit code ec
	if *optsProgressBar {
		fmt.Println()
	}
	os.Exit(ec)
}

// GetPathInfo resolves the PathInfo of the given path.
func GetPathInfo(path string) (putil.PathInfo, error) {

	var info putil.PathInfo

	if strings.HasPrefix(path, "i:") {

		ipath := strings.TrimSuffix(strings.TrimPrefix(path, "i:"), "/")

		info.Path = ipath
		info.Type = putil.TypeIrods

		// check if the namespace refers to a file object.
		if _, err := exec.Command("imeta", "ls", "-d", ipath).Output(); err == nil {
			info.Mode = 0
			return info, nil
		}

		// check if the namespace refers to a collection object.
		if _, err := exec.Command("imeta", "ls", "-C", ipath).Output(); err == nil {
			info.Mode = os.ModeDir
			return info, nil
		}

	} else {

		info.Path = path
		info.Type = putil.TypeFileSystem

		if fi, err := os.Stat(path); err == nil {
			info.Mode = fi.Mode()
			return info, nil
		}
	}

	return info, fmt.Errorf("file or directory not found: %s", path)
}

// GetNumberOfFiles get total number of files at or within the `path`.
func GetNumberOfFiles(path putil.PathInfo) (int, error) {

	nf := 0

	var cmds []string

	if path.Mode.IsRegular() {
		return 1, nil
	}

	// The path is a collection, use iquery to get number of files.
	if path.Mode.IsDir() && path.Type == putil.TypeIrods {
		cmds = append(cmds,
			fmt.Sprintf("iquest --no-page '%%s' \"SELECT DATA_NAME WHERE COLL_NAME = '%s'\" | wc -l", path.Path),
			fmt.Sprintf("iquest --no-page '%%s/%%s' \"SELECT COLL_NAME,DATA_NAME WHERE COLL_NAME like '%s/%%'\" | wc -l", path.Path),
		)
	}

	// The path is a filesystem directory, use command `find -type f` to get number of files.
	if path.Mode.IsDir() && path.Type == putil.TypeFileSystem {
		cmds = append(cmds, fmt.Sprintf("find %s -type f | wc -l", path.Path))
	}

	// run commands to get total number of files within the path.
	for _, cmd := range cmds {

		// run the command through bash
		out, err := exec.Command("bash", "-c", cmd).Output()
		if err != nil {
			return nf, fmt.Errorf("cannot count files: %s", err)
		}

		// remove the line ending "\n" from out
		n, err := strconv.Atoi(strings.TrimSuffix(string(out), "\n"))
		if err != nil {
			return nf, fmt.Errorf("cannot count files: %s", err)
		}

		nf += n
	}

	return nf, nil
}

// ReplError registers the error message of a particular file sync error.
type ReplError struct {
	File  string
	Error error
}

// ScanAndRepl walks through the files retrieved from the `bufio.Scanner`,
// replicate each file from the `rescSrc` iRODS resrouce to the `rescDst` iORDS resource.
//
// The sync operation is performed in a concurrent way.  The degree of concurrency is
// defined by number of sync workers, `nworkers`.
//
// Files being successfully synced will be returned as a map with key as the filename
// and value as the checksum of the file.
func ScanAndRepl(coll putil.PathInfo, rescSrc, rescDst string, nworkers int) (success chan string, failure chan ReplError) {

	success = make(chan string)
	failure = make(chan ReplError)

	// initiate a source scanner and performs the scan.
	scanner := putil.NewScanner(coll)

	files := scanner.ScanMakeDir(coll.Path, nworkers*8, nil)

	// create worker group
	var wg sync.WaitGroup
	wg.Add(nworkers)

	// spin off workers
	for i := 1; i <= nworkers; i++ {
		go replWorker(i, &wg, rescSrc, rescDst, files, success, failure)
	}

	go func() {
		// wait for all workers to finish.
		wg.Wait()
		// close success and failure channels.
		close(success)
		close(failure)
	}()

	return
}

func replWorker(id int, wg *sync.WaitGroup, rescSrc, rescDst string, files chan string, success chan string, failure chan ReplError) {

	for f := range files {
		// run irepl
		cmdExec := "irepl"
		cmdArgs := []string{"-v", "-S", rescSrc, "-R", rescDst, f}

		log.Debugf("exec: %s %s", cmdExec, strings.Join(cmdArgs, " "))

		if *optsDryrun {
			success <- f
			continue
		}

		if _, err := exec.Command(cmdExec, cmdArgs...).Output(); err != nil {
			failure <- ReplError{
				File:  f,
				Error: fmt.Errorf("%s %s fail: %s", cmdExec, strings.Join(cmdArgs, " "), err),
			}
		} else {
			success <- f
		}
	}
	wg.Done()
}
